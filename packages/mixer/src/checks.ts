// Mix checks. mixBalance() is a port of scripts/measure-mix-balance.py from motion-video-skill,
// Copyright (c) 2026 BestAgentKits, MIT License. https://github.com/bestagentkits/motion-video-skill
import { decodeMono, ffmpegReport } from "./ffmpeg.js";

export const LOUDNESS_TARGET = { integrated: -14, tolerance: 1, maxTruePeak: -1 };
export const BALANCE_TARGET = { min: 4, max: 6 }; // music this many dB under the voice while speaking

export interface Loudness {
  integrated: number; // LUFS
  truePeak: number; // dBTP
}

export async function measureLoudness(file: string): Promise<Loudness> {
  const log = await ffmpegReport(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const summary = log.slice(log.lastIndexOf("Summary"));
  const integrated = Number(/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary)?.[1] ?? NaN);
  const truePeak = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary)?.[1] ?? NaN);
  return { integrated, truePeak };
}

export interface MixBalance {
  musicUnderSpeech: number; // dB RMS
  musicInGaps: number;
  voice: number;
  musicBelowVoice: number; // voice - musicUnderSpeech
  gapShare: number; // share of the body with no speech
}

const SR = 8000;
const db = (x: Float32Array, mask: Uint8Array, want: boolean) => {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < x.length; i++) {
    if (!!mask[i] === want) {
      sum += x[i] * x[i];
      n++;
    }
  }
  return 10 * Math.log10(sum / Math.max(n, 1) + 1e-12);
};

// How loud the ducked music sits under the voice and in the gaps. Needs the stems written by mix({ stems: true }).
// Target from the reference projects: music ~5 dB under the voice while speaking, near voice level in the gaps;
// ~10 dB under reads as "there is no music".
export async function mixBalance(musicStem: string, voiceStem: string, speech: [number, number][], body?: [number, number]): Promise<MixBalance> {
  const [m, v] = await Promise.all([decodeMono(musicStem, SR), decodeMono(voiceStem, SR)]);
  const n = Math.min(m.length, v.length);
  const [from, to] = body ?? [1, n / SR];
  const speaking = new Uint8Array(n);
  for (const [on, off] of speech) speaking.fill(1, Math.max(0, Math.floor(on * SR)), Math.min(n, Math.floor(off * SR)));
  const lo = Math.floor(from * SR);
  const hi = Math.min(n, Math.floor(to * SR));
  const mb = m.subarray(lo, hi);
  const vb = v.subarray(lo, hi);
  const sb = speaking.subarray(lo, hi);
  const musicUnderSpeech = db(mb, sb, true);
  const voice = db(vb, sb, true);
  const gaps = sb.reduce((k, x) => k + (x ? 0 : 1), 0) / Math.max(sb.length, 1);
  const r = (x: number) => Math.round(x * 10) / 10;
  return {
    musicUnderSpeech: r(musicUnderSpeech),
    musicInGaps: r(db(mb, sb, false)),
    voice: r(voice),
    musicBelowVoice: r(voice - musicUnderSpeech),
    gapShare: r(gaps),
  };
}
