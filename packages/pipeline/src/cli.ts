// pnpm make-video ./examples/plan.json [options]
// pnpm make-video --prompt "..." [--url https://...] [options]
// pnpm make-video ./plan.json --csv rows.csv [options]       (batch: one video per row)
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { checkPlan, DirectorError, slug } from "@frameflow/director";
import { batchPlans, formatIssues, FORMATS, LANGUAGES, MOODS, parseCsv, type Format, type Mood } from "@frameflow/scene-schema";
import { loadSfxLibrary } from "./library.js";
import { ensureAudioService } from "./audio-client.js";
import { createContext } from "./context.js";
import { makeVideoFromPrompt } from "./from-prompt.js";
import { makeVideo, PlanError, STEPS, type MakeVideoResult, type StepEvent } from "./make-video.js";

const USAGE = `Usage:
  pnpm make-video <plan.json> [options]              render a hand-written scene plan
  pnpm make-video --prompt "<one line>" [options]    let the director write the plan
  pnpm make-video <plan.json> --csv <rows.csv>       batch: one video per CSV row, filling the
                                                     plan's {{column}} placeholders

Director options:
  --prompt "..."     what the video is about
  --url <url>        website to read the brand (logo, colors, fonts) and facts from
  --brand <file>     use an edited brand.json instead of reading the website
  --duration <s>     15, 30, 60 or 90 (default 30)
  --format <f>       16:9, 9:16 or 1:1 (default 16:9)
  --mood <m>         ${MOODS.join(", ")} (default: the director chooses)
  --language <l>     en, hi (Hindi) or hinglish (default en)

Render options:
  --draft            fast, lower-quality render (for iterating)
  --captions         burn word captions into the video
  --no-social        skip the smaller social version
  --formats <list>   also render these formats from the same plan, e.g. 9:16,1:1
  -h, --help         show this help`;

const label = Object.fromEntries(STEPS.map((s) => [s.id, s.label]));
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function fail(message: string): never {
  throw new PlanError(`${message}\n\n${USAGE}`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      prompt: { type: "string" },
      url: { type: "string" },
      brand: { type: "string" },
      duration: { type: "string", default: "30" },
      format: { type: "string", default: "16:9" },
      mood: { type: "string" },
      language: { type: "string", default: "en" },
      draft: { type: "boolean", default: false },
      captions: { type: "boolean", default: false },
      "no-social": { type: "boolean", default: false },
      formats: { type: "string" },
      csv: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help || (!positionals[0] && !values.prompt)) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  if (positionals[0] && values.prompt) fail("give either a plan file or --prompt, not both");
  if (values.csv && !positionals[0]) fail("--csv needs a plan file with {{column}} placeholders");
  const formats = (values.formats ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  const badFormat = formats.find((f) => !(FORMATS as readonly string[]).includes(f));
  if (badFormat) fail(`--formats takes ${FORMATS.join(", ")} (got ${badFormat})`);

  const cwd = process.env.INIT_CWD ?? process.cwd(); // pnpm runs scripts from the repo root
  const show = (p: string) => relative(cwd, p) || ".";
  const ctx = createContext();
  const render = {
    storage: ctx.storage,
    audio: ctx.audio,
    renderer: ctx.renderer,
    assetsDir: ctx.assetsDir,
    quality: values.draft ? ("draft" as const) : ("high" as const),
    burnCaptions: values.captions,
    social: !values["no-social"],
    formats: formats as Format[],
  };

  if (values.csv) return batch(positionals[0], values.csv, cwd, show, ctx, render);

  let run: (onEvent: (e: StepEvent) => void) => Promise<MakeVideoResult>;
  if (values.prompt) {
    const durationSec = Number(values.duration);
    if (![15, 30, 60, 90].includes(durationSec)) fail(`--duration must be 15, 30, 60 or 90 (got ${values.duration})`);
    if (!(FORMATS as readonly string[]).includes(values.format!)) fail(`--format must be one of ${FORMATS.join(", ")}`);
    if (values.mood && !(MOODS as readonly string[]).includes(values.mood)) fail(`--mood must be one of ${MOODS.join(", ")}`);
    if (!(LANGUAGES as readonly string[]).includes(values.language!)) fail(`--language must be one of ${LANGUAGES.join(", ")}`);
    if (values.url && !/^https?:\/\//.test(values.url)) fail("--url must start with http:// or https://");
    console.log(`\nFrameflow: "${values.prompt}"${values.url ? ` (${values.url})` : ""}, ${durationSec}s ${values.format}\n`);
    run = (onEvent) =>
      makeVideoFromPrompt({
        ...render,
        prompt: values.prompt!,
        url: values.url,
        brandFile: values.brand ? resolve(cwd, values.brand) : undefined,
        durationSec,
        format: values.format as Format,
        mood: values.mood as Mood | undefined,
        language: values.language as (typeof LANGUAGES)[number],
        onEvent,
      });
  } else {
    const planPath = resolve(cwd, positionals[0]);
    let plan: unknown;
    try {
      plan = JSON.parse(await readFile(planPath, "utf8"));
    } catch (e) {
      throw new PlanError(`could not read ${show(planPath)}: ${(e as Error).message}`);
    }
    console.log(`\nFrameflow: making a video from ${show(planPath)}\n`);
    run = (onEvent) => makeVideo({ ...render, plan, planDir: dirname(planPath), onEvent });
  }

  const stopAudio = await ensureAudioService(ctx.audio, ctx.root, ctx.storage.path("audio-service.log"), (m) => console.log(`  · ${m}`));
  const started = Date.now();
  try {
    const r = await run((e) => {
      if (e.status === "done") console.log(`  ✓ ${label[e.step].padEnd(24)} ${secs(e.ms!)}`);
      else if (e.status === "info") console.log(`    · ${e.message}`);
      else if (e.status === "warn") console.log(`    ! ${e.message}`);
    });

    console.log(`\nDone in ${secs(Date.now() - started)}: a ${r.timing.duration.toFixed(1)}s video`);
    console.log(`  video    ${show(r.video)}`);
    if (r.social) console.log(`  social   ${show(r.social)}`);
    console.log(`  folder   ${show(r.outDir)}  (plan, timing, cues, captions, qa.json, credits.txt)`);
    console.log(`\nChecks`);
    for (const c of r.qa.checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.name.padEnd(18)} ${c.detail}`);
    if (r.qa.warnings.length) {
      console.log(`\nWarnings`);
      r.qa.warnings.forEach((w) => console.log(`  - ${w}`));
    }
    console.log(`\nMusic credit (CC BY 4.0, must be shown with the video) is in credits.txt\n`);
    if (r.qa.checks.some((c) => !c.ok)) process.exitCode = 2;
  } finally {
    stopAudio();
  }
}

// One video per CSV row. Every row is checked first (lengths, pacing); rows that fail are skipped.
async function batch(planFile: string, csvFile: string, cwd: string, show: (p: string) => string, ctx: ReturnType<typeof createContext>, render: Omit<Parameters<typeof makeVideo>[0], "plan" | "planDir">) {
  const planPath = resolve(cwd, planFile);
  const plan = JSON.parse(await readFile(planPath, "utf8")) as { id: string; title?: string };
  const csv = parseCsv(await readFile(resolve(cwd, csvFile), "utf8"));
  const rows = batchPlans(plan, csv);
  const sfxIds = (await loadSfxLibrary(ctx.assetsDir)).map((s) => s.id);
  console.log(`\nFrameflow batch: ${rows.length} videos from ${show(planPath)} and ${csvFile}\n`);

  const stopAudio = await ensureAudioService(ctx.audio, ctx.root, ctx.storage.path("audio-service.log"), (m) => console.log(`  · ${m}`));
  const results: { row: number; name: string; status: string }[] = [];
  try {
    for (const r of rows) {
      const name = slug(Object.values(r.values)[0] ?? String(r.row)).slice(0, 24);
      const id = `${plan.id}-${String(r.row).padStart(3, "0")}-${name}`;
      const filled = { ...(r.plan as object), id, version: 1 };
      const check = await checkPlan(filled, { sfxIds, brandFixed: true });
      if (!check.ok) {
        results.push({ row: r.row, name, status: `skipped: ${formatIssues(check.errors).split("\n").join("; ")}` });
        console.log(`  ✗ row ${r.row} (${name}): skipped, the filled plan does not pass\n${formatIssues(check.errors).replace(/^/gm, "      ")}`);
        continue;
      }
      const t = Date.now();
      try {
        const v = await makeVideo({ ...render, plan: filled, planDir: dirname(planPath) });
        const failed = v.qa.checks.filter((c) => !c.ok).map((c) => c.name);
        results.push({ row: r.row, name, status: failed.length ? `done, checks failed: ${failed.join(", ")}` : "done" });
        console.log(`  ✓ row ${r.row} (${name}): ${show(v.video)} in ${secs(Date.now() - t)}${failed.length ? ` (failed checks: ${failed.join(", ")})` : ""}`);
      } catch (e) {
        results.push({ row: r.row, name, status: `failed: ${(e as Error).message.split("\n")[0]}` });
        console.log(`  ✗ row ${r.row} (${name}): ${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    stopAudio();
  }
  const done = results.filter((r) => r.status.startsWith("done")).length;
  console.log(`\n${done}/${rows.length} videos made. Music credit (CC BY 4.0) is in each folder's credits.txt\n`);
  if (done < rows.length) process.exitCode = 2;
}

main().catch((e: Error) => {
  const expected = e instanceof PlanError || e instanceof DirectorError || /CSV|placeholder|row \d/.test(e.message);
  console.error(`\n✗ ${expected ? e.message : (e.stack ?? e.message)}\n`);
  process.exit(1);
});
