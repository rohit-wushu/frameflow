import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_BUFFER = 1 << 28;

export async function ffmpeg(args: string[]): Promise<string> {
  try {
    const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args], { maxBuffer: MAX_BUFFER });
    return stderr;
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg failed: ${err.message}\n${(err.stderr ?? "").split("\n").slice(-15).join("\n")}`);
  }
}

// ffmpeg writes analysis reports (ebur128, loudnorm, blackdetect) to stderr.
export async function ffmpegReport(args: string[]): Promise<string> {
  try {
    const { stderr } = await run("ffmpeg", ["-hide_banner", "-nostats", ...args], { maxBuffer: MAX_BUFFER });
    return stderr;
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg failed: ${err.message}\n${(err.stderr ?? "").split("\n").slice(-15).join("\n")}`);
  }
}

export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(stdout.trim());
}

// Decode to mono float32 PCM at `sampleRate`.
export function decodeMono(file: string, sampleRate: number): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(sampleRate), "-f", "f32le", "-"]);
    const chunks: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (c: Buffer) => (stderr += c));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg decode failed for ${file}: ${stderr}`));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
    });
  });
}
