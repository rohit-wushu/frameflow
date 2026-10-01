// Post-render steps and checks, from motion-video-skill's production pipeline (steps 8-9),
// Copyright (c) 2026 BestAgentKits, MIT License. https://github.com/bestagentkits/motion-video-skill
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ffmpeg, ffmpegReport, LOUDNESS_TARGET, measureLoudness } from "@frameflow/mixer";

const run = promisify(execFile);

// Put the untouched mix back on the video: the renderer re-encodes AAC and can push the true peak up.
export async function remux(video: string, audio: string, out: string) {
  await ffmpeg(["-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", out]);
}

// Smaller file for social upload (the reference got 406 MB -> 102 MB at SSIM 0.977).
export async function socialEncode(input: string, out: string) {
  await ffmpeg([
    "-i", input, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "6M", "-bufsize", "12M",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1", "-g", "60",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out,
  ]);
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function verifyVideo(file: string, expected: { width: number; height: number; fps: number; duration: number }): Promise<Check[]> {
  const checks: Check[] = [];
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
    "-show_entries", "format=duration", "-of", "json", file,
  ]);
  const probe = JSON.parse(stdout) as { streams: Record<string, string | number>[]; format: { duration: string } };
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  const [num, den] = String(v?.r_frame_rate ?? "0/1").split("/").map(Number);
  const fps = num / den;
  checks.push({ name: "video size", ok: v?.width === expected.width && v?.height === expected.height, detail: `${v?.width}x${v?.height} (want ${expected.width}x${expected.height})` });
  checks.push({ name: "frame rate", ok: Math.abs(fps - expected.fps) < 0.01, detail: `${fps.toFixed(2)} fps` });
  const duration = Number(probe.format.duration);
  checks.push({ name: "duration", ok: Math.abs(duration - expected.duration) < 0.15, detail: `${duration.toFixed(2)}s (want ${expected.duration.toFixed(2)}s)` });
  checks.push({ name: "audio", ok: a?.codec_name === "aac" && Number(a?.sample_rate) === 48000 && a?.channels === 2, detail: `${a?.codec_name} ${a?.sample_rate} Hz ${a?.channels}ch` });

  const { integrated, truePeak } = await measureLoudness(file);
  checks.push({
    name: "loudness",
    ok: Math.abs(integrated - LOUDNESS_TARGET.integrated) <= LOUDNESS_TARGET.tolerance && truePeak <= LOUDNESS_TARGET.maxTruePeak,
    detail: `${integrated} LUFS, true peak ${truePeak} dBTP (want ${LOUDNESS_TARGET.integrated}±${LOUDNESS_TARGET.tolerance} LUFS, peak <= ${LOUDNESS_TARGET.maxTruePeak})`,
  });

  // black frames are only allowed in the fade-in and the fade-out
  const log = await ffmpegReport(["-i", file, "-vf", "blackdetect=d=0.1:pix_th=0.05", "-an", "-f", "null", "-"]);
  const black = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const bad = black.filter(([s, e]) => !(s < 0.05 && e < 0.4) && !(s > duration - 0.8));
  checks.push({ name: "no black frames", ok: bad.length === 0, detail: bad.length ? bad.map(([s, e]) => `${s.toFixed(2)}-${e.toFixed(2)}s`).join(", ") : "only in the fades" });
  return checks;
}
