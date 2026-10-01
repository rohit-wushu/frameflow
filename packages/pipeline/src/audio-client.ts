import { spawn, type ChildProcess } from "node:child_process";
import { openSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AlignedWord } from "@frameflow/timing";

export interface BeatsResult {
  bpm: number;
  beats: number[];
  downbeats: number[];
  duration: number;
}

// Retry once, then fail with a clear message (the spec: retry a failed step, then show the error).
async function withRetry<T>(what: string, fn: () => Promise<T>, attempts = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e instanceof ClientError) break; // bad input will not fix itself
    }
  }
  throw new Error(`${what} failed: ${(last as Error).message}`);
}

class ClientError extends Error {}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  const body = await res.text();
  let detail = body;
  try {
    detail = JSON.parse(body).detail ?? body;
  } catch {}
  const Err = res.status >= 400 && res.status < 500 ? ClientError : Error;
  throw new Err(`HTTP ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

// Client for services/audio (FastAPI): /tts (Kokoro, or Indic Parler through services/parler), /align (WhisperX), /beats (librosa).
export class AudioClient {
  constructor(readonly baseUrl: string) {}

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  tts(text: string, voiceId: string, speed: number, engine: string, style?: string | null): Promise<Buffer> {
    return withRetry("text to speech", async () => {
      const res = await check(
        await fetch(`${this.baseUrl}/tts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, voiceId, speed, engine, style: style ?? null }),
          // Indic Parler loads (and the first time downloads) its model on the first request
          signal: AbortSignal.timeout(engine === "indic-parler" ? 30 * 60_000 : 5 * 60_000),
        }),
      );
      return Buffer.from(await res.arrayBuffer());
    });
  }

  align(wav: Buffer, text: string, language: string): Promise<{ words: AlignedWord[]; duration: number }> {
    return withRetry("alignment", async () => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "voice.wav");
      form.append("text", text);
      form.append("language", language);
      const res = await check(await fetch(`${this.baseUrl}/align`, { method: "POST", body: form }));
      return (await res.json()) as { words: AlignedWord[]; duration: number };
    });
  }

  // Free the service's models before rendering (they reload on the next request). Best effort.
  async unload(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/unload`, { method: "POST", signal: AbortSignal.timeout(10000) });
    } catch {}
  }

  beats(file: string, bpmHint?: number): Promise<BeatsResult> {
    return withRetry("beat detection", async () => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(await readFile(file))]), basename(file));
      if (bpmHint) form.append("bpm_hint", String(bpmHint));
      const res = await check(await fetch(`${this.baseUrl}/beats`, { method: "POST", body: form }));
      return (await res.json()) as BeatsResult;
    });
  }
}

// Start the local audio service if it is not running yet. Returns a function that stops it
// again (a no-op when the service was already running).
export async function ensureAudioService(client: AudioClient, repoRoot: string, logFile: string, onInfo: (m: string) => void): Promise<() => void> {
  if (await client.health()) return () => {};
  const url = new URL(client.baseUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`the audio service at ${client.baseUrl} is not reachable`);
  onInfo(`starting the audio service on port ${url.port} (log: ${logFile})`);
  const out = openSync(logFile, "a");
  let proc: ChildProcess;
  try {
    proc = spawn("uv", ["run", "uvicorn", "app.main:app", "--host", url.hostname, "--port", url.port], {
      cwd: join(repoRoot, "services/audio"),
      stdio: ["ignore", out, out],
    });
  } catch (e) {
    throw new Error(`could not start the audio service (is uv installed? run \`pnpm audio:setup\`): ${(e as Error).message}`);
  }
  let exited = false;
  proc.on("exit", () => (exited = true));
  for (let i = 0; i < 120; i++) {
    if (exited) throw new Error(`the audio service exited while starting; see ${logFile}`);
    if (await client.health()) return () => proc.kill();
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error(`the audio service did not become healthy within 60 s; see ${logFile}`);
}
