import { describe, expect, it } from "vitest";
import { buildCaptions, computeTiming, toSrt, toVtt } from "../src/index.js";
import { makePlan, scene, templates, voice } from "./helpers.js";

describe("captions", () => {
  const text = "Type one line, get a finished video with music and sound effects.";
  const plan = makePlan([scene("a", "hero_text", text, 5), scene("c", "logo_reveal", "", 3)]);
  const timing = computeTiming(plan, { a: voice(text, 4.5) }, null, templates);
  const chunks = buildCaptions(timing, 6);

  it("keeps every word, in order", () => {
    expect(chunks.flatMap((c) => c.words.map((w) => w.text)).join(" ")).toBe(text);
  });

  it("breaks at punctuation and at the word limit", () => {
    expect(chunks[0].words.map((w) => w.text).join(" ")).toBe("Type one line,");
    expect(chunks.every((c) => c.words.length <= 6)).toBe(true);
  });

  it("never overlaps the next chunk and stays inside its scene", () => {
    for (let i = 0; i < chunks.length - 1; i++) expect(chunks[i].end).toBeLessThan(chunks[i + 1].start);
    expect(chunks[chunks.length - 1].end).toBeLessThanOrEqual(timing.scenes[0].end);
  });

  it("writes SRT and VTT", () => {
    expect(toSrt(chunks)).toMatch(/^1\n00:00:00,\d{3} --> 00:00:0\d,\d{3}\nType one line,\n/);
    expect(toVtt(chunks)).toMatch(/^WEBVTT\n\n00:00:00\.\d{3} --> /);
  });
});
