import type { TimingResult } from "./types.js";

export interface CaptionChunk {
  sceneId: string;
  start: number;
  end: number;
  words: { text: string; s: number; e: number }[];
}

const round = (x: number) => Math.round(x * 1000) / 1000;

// Word-level captions from the alignment: short chunks that break at punctuation and never cross a cut.
export function buildCaptions(timing: TimingResult, maxWords = 6): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  for (const scene of timing.scenes) {
    let current: CaptionChunk["words"] = [];
    const flush = () => {
      if (!current.length) return;
      chunks.push({ sceneId: scene.id, start: 0, end: 0, words: current });
      current = [];
    };
    scene.words.forEach((w, i) => {
      current.push({ text: w.text, s: w.s, e: w.e });
      const left = scene.words.length - i - 1;
      const punct = /[,.:;?!]$/.test(w.text);
      if (current.length >= maxWords || (punct && current.length >= 2 && left >= 2)) flush();
    });
    flush();
  }
  // Show each chunk from just before its first word until just after its last one,
  // but hand over to the next chunk cleanly: two captions are never on screen together.
  let prevEnd = -Infinity;
  chunks.forEach((c, i) => {
    const scene = timing.scenes.find((s) => s.id === c.sceneId)!;
    const next = chunks[i + 1];
    const last = c.words[c.words.length - 1];
    const start = Math.max(scene.start, c.words[0].s - 0.1, prevEnd + 0.02);
    let end = Math.min(last.e + 0.4, scene.end - 0.05);
    if (next) end = Math.min(end, next.words[0].s - 0.08);
    c.start = round(start);
    c.end = round(Math.max(end, start + 0.1));
    prevEnd = c.end;
  });
  return chunks;
}

function stamp(t: number, sep: string): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

export function toSrt(chunks: CaptionChunk[]): string {
  return chunks.map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.words.map((w) => w.text).join(" ")}\n`).join("\n");
}

export function toVtt(chunks: CaptionChunk[]): string {
  return "WEBVTT\n\n" + chunks.map((c) => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.words.map((w) => w.text).join(" ")}\n`).join("\n");
}
