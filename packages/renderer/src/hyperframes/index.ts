import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Renderer, RenderRequest, RenderResult, SnapshotRequest } from "../types.js";
import { remux } from "../video.js";
import { composeProject } from "./compose.js";

const require = createRequire(import.meta.url);
export const HYPERFRAMES_VERSION = "0.7.99"; // pinned, like motion-video-skill, so renders stay reproducible
const BIN = join(dirname(require.resolve("hyperframes/package.json")), "bin", "hyperframes.mjs");
const ENV = {
  ...process.env,
  HYPERFRAMES_NO_TELEMETRY: "1",
  HYPERFRAMES_NO_UPDATE_CHECK: "1",
  HYPERFRAMES_SKIP_SKILLS: "1",
  DO_NOT_TRACK: "1",
  NO_COLOR: "1",
};

function hyperframes(args: string[], cwd: string, logFile: string, onLine?: (line: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const log = createWriteStream(logFile, { flags: "a" });
    log.write(`\n$ hyperframes ${args.join(" ")}\n`);
    const proc = spawn(process.execPath, [BIN, ...args], { cwd, env: ENV });
    let out = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      out += text;
      log.write(text);
      if (onLine) text.split(/[\r\n]+/).filter((l) => l.trim()).forEach((l) => onLine(l.trim()));
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("error", reject);
    proc.on("close", (code) => {
      log.end();
      if (code === 0) resolve(out);
      else reject(new Error(`hyperframes ${args[0]} failed (exit ${code}); see ${logFile}\n${out.split("\n").slice(-20).join("\n")}`));
    });
  });
}

// One generated file holds every scene, so it is always "large"; the reference compositions
// (1300-1600 lines) render fine with this warning.
const IGNORED_LINT = new Set(["composition_file_too_large"]);

interface LintFinding {
  severity?: string;
  code?: string;
  message?: string;
}

async function lint(projectDir: string, logFile: string): Promise<string[]> {
  const out = await hyperframes(["lint", projectDir, "--json"], projectDir, logFile).catch((e: Error) => e.message);
  const json = /\{[\s\S]*\}\s*$/.exec(out)?.[0];
  if (!json) return [];
  const report = JSON.parse(json) as { findings?: LintFinding[]; errors?: LintFinding[] };
  const findings = report.findings ?? report.errors ?? [];
  const errors = findings.filter((f) => f.severity === "error");
  if (errors.length) throw new Error(`hyperframes lint found errors:\n${errors.map((f) => `- ${f.code}: ${f.message}`).join("\n")}`);
  return findings.filter((f) => f.severity === "warning" && !IGNORED_LINT.has(f.code ?? "")).map((f) => `lint ${f.code}: ${f.message}`);
}

export class HyperFramesRenderer implements Renderer {
  readonly name = `hyperframes@${HYPERFRAMES_VERSION}`;

  constructor(private readonly fontCacheDir: string) {}

  private async compose(req: Omit<RenderRequest, "output" | "quality">) {
    const projectDir = join(req.workDir, "composition");
    await rm(projectDir, { recursive: true, force: true });
    const { warnings } = await composeProject({ ...req, projectDir, fontCacheDir: this.fontCacheDir });
    const logFile = join(req.workDir, "hyperframes.log");
    warnings.push(...(await lint(projectDir, logFile)));
    return { projectDir, logFile, warnings };
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    const { projectDir, logFile, warnings } = await this.compose(req);
    const raw = join(req.workDir, "video-raw.mp4");
    let lastPct = -1;
    const renderOnce = () =>
      hyperframes(["render", projectDir, "-q", req.quality, "-f", String(req.timing.fps), "-o", raw], projectDir, logFile, (line) => {
        const pct = Number(/(\d{1,3})%/.exec(line)?.[1] ?? NaN);
        if (pct > lastPct && pct % 25 === 0) {
          lastPct = pct;
          req.onProgress?.(`${pct}%`);
        }
      });
    try {
      await renderOnce();
    } catch (e) {
      // headless Chrome can crash under memory pressure ("Target closed"); one retry, then fail clearly
      warnings.push(`the first render attempt failed and was retried: ${(e as Error).message.split("\n")[0]}`);
      req.onProgress?.("render failed, retrying once");
      lastPct = -1;
      await renderOnce();
    }
    await remux(raw, req.mixFile, req.output);
    return { video: req.output, projectDir, warnings };
  }

  async snapshot(req: SnapshotRequest): Promise<string[]> {
    const { projectDir, logFile } = await this.compose(req);
    await mkdir(req.outDir, { recursive: true });
    const at = req.times.map((t) => t.toFixed(2)).join(",");
    await hyperframes(["snapshot", projectDir, "--at", at, "--no-end", "--describe", "false", "-o", req.outDir], projectDir, logFile);
    return (await readdir(req.outDir)).filter((f) => f.endsWith(".png")).map((f) => join(req.outDir, f));
  }
}
