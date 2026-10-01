import { describe, expect, it } from "vitest";
import { TIMING_DEFAULTS, anchorWord, applyTiming, computeTiming, itemRevealTimes, snapToBeat } from "../src/index.js";
import { grid, makePlan, scene, templates, voice } from "./helpers.js";

const { voiceLead, tailPad, minTail } = TIMING_DEFAULTS;

describe("snapToBeat", () => {
  const beats = [0, 0.5, 1, 1.5, 2];

  it("picks the nearest beat within the max shift", () => {
    expect(snapToBeat(1.1, beats, { earliest: 0, latest: 9, maxShift: 0.25 })).toBe(1);
    expect(snapToBeat(1.4, beats, { earliest: 0, latest: 9, maxShift: 0.25 })).toBe(1.5);
  });

  it("never picks a beat earlier than allowed (e.g. before the voice ends)", () => {
    expect(snapToBeat(1.1, beats, { earliest: 1.05, latest: 9, maxShift: 0.25 })).toBe(null);
    expect(snapToBeat(1.2, beats, { earliest: 1.05, latest: 9, maxShift: 0.35 })).toBe(1.5);
  });

  it("returns null when no beat is close enough", () => {
    expect(snapToBeat(1.25, [0, 2], { earliest: 0, latest: 9, maxShift: 0.25 })).toBe(null);
  });
});

describe("computeTiming without music", () => {
  it("makes each scene voice length + padding, back to back", () => {
    const plan = makePlan([
      scene("a", "hero_text", "one two three", 3),
      scene("b", "feature_grid", "four five six seven", 4),
      scene("c", "logo_reveal", "", 3),
    ]);
    const t = computeTiming(plan, { a: voice("one two three", 2), b: voice("four five six seven", 3) }, null, templates);
    expect(t.scenes[0]).toMatchObject({ start: 0, voiceStart: voiceLead });
    expect(t.scenes[0].duration).toBeCloseTo(voiceLead + 2 + tailPad);
    expect(t.scenes[0].voiceEnd).toBeCloseTo(voiceLead + 2);
    expect(t.scenes[1].start).toBeCloseTo(t.scenes[0].end);
    expect(t.scenes[1].duration).toBeCloseTo(voiceLead + 3 + tailPad);
    expect(t.scenes[2].duration).toBe(3); // no voice: the director's estimate, within limits
    expect(t.duration).toBeCloseTo(t.scenes[2].end);
    expect(t.warnings).toEqual([]);
  });

  it("lets the last scene hold after its voice", () => {
    const plan = makePlan([scene("a", "hero_text", "one", 2), scene("c", "logo_reveal", "brand name", 3)]);
    const t = computeTiming(plan, { a: voice("one", 1), c: voice("brand name", 1.2) }, null, templates);
    expect(t.scenes[1].duration).toBeCloseTo(voiceLead + 1.2 + tailPad + TIMING_DEFAULTS.endHold);
  });

  it("clamps to the template's minimum", () => {
    const plan = makePlan([scene("a", "hero_text", "hi", 2), scene("c", "logo_reveal", "", 3)]);
    const t = computeTiming(plan, { a: voice("hi", 0.4) }, null, templates);
    expect(t.scenes[0].duration).toBe(2);
  });

  it("stretches a scene past its maximum rather than cutting off the voice, with a warning", () => {
    const plan = makePlan([scene("a", "hero_text", "a very long line", 6), scene("c", "logo_reveal", "", 3)]);
    const t = computeTiming(plan, { a: voice("a very long line", 7) }, null, templates);
    expect(t.scenes[0].duration).toBeCloseTo(voiceLead + 7 + minTail);
    expect(t.warnings[0]).toMatch(/does not fit/);
  });

  it("puts spoken words in video time", () => {
    const plan = makePlan([scene("a", "hero_text", "one two", 2), scene("b", "feature_grid", "Three, four", 3), scene("c", "logo_reveal", "", 3)]);
    const t = computeTiming(plan, { a: voice("one two", 1.5), b: voice("Three, four", 2) }, null, templates);
    const b = t.scenes[1];
    expect(b.words[0]).toEqual({ w: "three", text: "Three,", s: b.start + voiceLead, e: b.start + voiceLead + 0.8 });
  });

  it("puts the accent at the template's accentAt", () => {
    const plan = makePlan([scene("a", "hero_text", "one", 2), scene("c", "logo_reveal", "", 3)]);
    const t = computeTiming(plan, { a: voice("one", 1) }, null, templates);
    expect(t.scenes[1].accent).toBeCloseTo(t.scenes[1].start + 0.6);
  });

  it("fails loudly when a spoken scene has no audio", () => {
    const plan = makePlan([scene("a", "hero_text", "one", 2), scene("c", "logo_reveal", "", 3)]);
    expect(() => computeTiming(plan, {}, null, templates)).toThrow(/no voice audio/);
  });
});

describe("computeTiming with a beat grid", () => {
  const plan = makePlan([
    scene("a", "hero_text", "one two three", 3),
    scene("b", "feature_grid", "four five six", 4),
    scene("c", "logo_reveal", "", 3),
  ]);
  const voices = { a: voice("one two three", 2.1), b: voice("four five six", 2.9) };

  it("lands every cut on a beat, within 250 ms of where it would be, after the voice ends", () => {
    const g = grid(120);
    const t = computeTiming(plan, voices, g, templates);
    for (const s of t.scenes.slice(0, -1)) {
      expect(g.beats).toContain(s.end);
      expect(Math.abs(s.end - s.cutOut!.natural)).toBeLessThanOrEqual(0.25 + 1e-9);
      expect(s.end).toBeGreaterThanOrEqual(s.voiceEnd! + minTail - 1e-9);
    }
    expect(t.warnings).toEqual([]);
  });

  it("chains cuts: the next scene starts on the snapped beat", () => {
    const t = computeTiming(plan, voices, grid(120), templates);
    expect(t.scenes[1].start).toBe(t.scenes[0].end);
    expect(t.scenes[1].voiceStart).toBeCloseTo(t.scenes[0].end + voiceLead);
  });

  it("leaves a cut off the beat (with a warning) when no beat is close enough", () => {
    const sparse = { bpm: 20, beats: [0, 30], downbeats: [0] };
    const t = computeTiming(plan, voices, sparse, templates);
    expect(t.scenes[0].cutOut!.beat).toBe(null);
    expect(t.scenes[0].end).toBeCloseTo(voiceLead + 2.1 + tailPad);
    expect(t.warnings.length).toBe(2);
  });

  it("keeps a list scene on screen after its last item, even when the item is the last word", () => {
    const items = { items: [{ title: "Four" }, { title: "Five" }, { title: "Six" }] };
    const p = makePlan([scene("a", "hero_text", "one two three", 3), scene("b", "feature_grid", "four five six", 4, items), scene("c", "logo_reveal", "", 3)]);
    const withoutGrid = computeTiming(p, voices, null, templates).scenes[1];
    const last = withoutGrid.items[withoutGrid.items.length - 1];
    expect(withoutGrid.end - last).toBeGreaterThanOrEqual(TIMING_DEFAULTS.itemHold - 1e-9);
    const withGrid = computeTiming(p, voices, grid(120), templates).scenes[1];
    expect(withGrid.end - withGrid.items[withGrid.items.length - 1]).toBeGreaterThanOrEqual(TIMING_DEFAULTS.itemHold * 0.75 - 1e-9);
  });

  it("waits for the next beat when the nearby ones are blocked by the voice", () => {
    // voice ends at 0.2 + 2.1 = 2.3; natural cut 2.65; earliest 2.42. Beats at 2.0 and 3.0 only:
    // 2.0 is before the voice ends and 3.0 is 350 ms away, so the cut waits for 3.0
    const t = computeTiming(plan, voices, { bpm: 60, beats: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], downbeats: [0, 4, 8, 12] }, templates);
    expect(t.scenes[0].end).toBe(3);
    expect(t.scenes[0].cutOut).toMatchObject({ natural: 2.65, beat: 3 });
  });

  it("keeps only beats inside the video", () => {
    const t = computeTiming(plan, voices, grid(120), templates);
    expect(Math.max(...t.beats)).toBeLessThanOrEqual(t.duration);
  });

  it("writes start and duration back into the plan", () => {
    const t = computeTiming(plan, voices, grid(120), templates);
    const timed = applyTiming(plan, t);
    expect(timed.scenes.map((s) => [s.start, s.duration])).toEqual(t.scenes.map((s) => [s.start, s.duration]));
  });
});

describe("list items", () => {
  const words = [
    { w: "it", text: "It", s: 1.0, e: 1.1 },
    { w: "writes", text: "writes", s: 1.2, e: 1.4 },
    { w: "the", text: "the", s: 1.45, e: 1.5 },
    { w: "script", text: "script,", s: 1.55, e: 1.9 },
    { w: "records", text: "records", s: 2.0, e: 2.3 },
    { w: "the", text: "the", s: 2.35, e: 2.4 },
    { w: "voiceover", text: "voiceover,", s: 2.45, e: 3.0 },
    { w: "and", text: "and", s: 3.1, e: 3.2 },
    { w: "cuts", text: "cuts", s: 3.25, e: 3.5 },
    { w: "on", text: "on", s: 3.55, e: 3.6 },
    { w: "beat", text: "beat.", s: 3.7, e: 4.0 },
  ];

  it("finds the anchor word of an item", () => {
    expect(anchorWord({ title: "The Script" })).toBe("script");
    expect(anchorWord({ title: "Beat-synced cuts" })).toBe("beat");
    expect(anchorWord("Voiceover")).toBe("voiceover");
  });

  it("reveals each item just before the narrator says it", () => {
    const t = itemRevealTimes([{ title: "Script" }, { title: "Voiceover" }, { title: "Beat-synced cuts" }], words, [1, 4]);
    expect(t).toEqual([1.47, 2.37, 3.62]);
  });

  it("spreads items that are never spoken evenly, keeping order", () => {
    const t = itemRevealTimes([{ title: "Alpha" }, { title: "Bravo" }, { title: "Charlie" }], words, [1, 4]);
    expect(t).toEqual([1, 2, 3]);
  });

  it("keeps unspoken items before the next spoken one", () => {
    const t = itemRevealTimes([{ title: "Alpha" }, { title: "Script" }], words, [1, 4]);
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBe(1.47);
  });
});
