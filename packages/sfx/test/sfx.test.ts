import type { Scene, ScenePlan } from "@frameflow/scene-schema";
import type { SceneTiming, TimingResult } from "@frameflow/timing";
import { describe, expect, it } from "vitest";
import { placeSfx, type SfxSound, type TemplateSfx } from "../src/index.js";

const library: SfxSound[] = [
  { id: "whoosh", file: "whoosh.wav", duration: 0.75, hitOffset: 0.4, gain: 0.55 },
  { id: "swoosh", file: "swoosh.wav", duration: 0.38, hitOffset: 0.17, gain: 0.45 },
  { id: "pop", file: "pop.wav", duration: 0.11, hitOffset: 0, gain: 0.5 },
  { id: "riser", file: "riser.wav", duration: 2, hitOffset: 2, gain: 0.4 },
  { id: "impact", file: "impact.wav", duration: 1.8, hitOffset: 0.005, gain: 0.8 },
  { id: "ding", file: "ding.wav", duration: 0.5, hitOffset: 0, gain: 0.45 },
];
const templates: Record<string, TemplateSfx> = {
  hero_text: {},
  feature_grid: { listField: "items" },
  logo_reveal: { accentSound: "impact" },
};

function scene(id: string, template: string, extra: Partial<Scene> = {}): Scene {
  return { id, template, content: {}, voiceover: "", estDuration: 3, sfx: [], transitionOut: "cut", ...extra };
}

function sceneTiming(id: string, template: string, start: number, end: number, extra: Partial<SceneTiming> = {}): SceneTiming {
  return { id, template, start, end, duration: end - start, voiceStart: null, voiceEnd: null, words: [], items: [], accent: null, cutOut: null, ...extra };
}

function setup(scenes: Scene[], timings: SceneTiming[]) {
  const plan = { scenes } as ScenePlan;
  const timing = { duration: timings[timings.length - 1].end, fps: 30, bpm: 120, beats: [], downbeats: [], scenes: timings, warnings: [] } as TimingResult;
  return placeSfx(plan, timing, library, templates);
}

const threeScenes = () => [
  scene("hook", "hero_text"),
  scene("grid", "feature_grid", { content: { items: [{ title: "a" }, { title: "b" }, { title: "c" }] } }),
  scene("logo", "logo_reveal"),
];
const threeTimings = () => [
  sceneTiming("hook", "hero_text", 0, 3),
  sceneTiming("grid", "feature_grid", 3, 8, { items: [3.5, 4.5, 5.5] }),
  sceneTiming("logo", "logo_reveal", 8, 12, { accent: 8.6 }),
];

describe("placeSfx defaults", () => {
  const { cues, warnings } = setup(threeScenes(), threeTimings());

  it("puts a whoosh on every cut, peaking on the cut", () => {
    const whooshes = cues.filter((c) => c.sound === "whoosh");
    expect(whooshes.map((c) => c.event)).toEqual([3, 8]);
    expect(whooshes[0].t).toBeCloseTo(3 - 0.4);
  });

  it("does not whoosh into the first scene", () => {
    expect(cues.some((c) => c.sound === "whoosh" && c.event === 0)).toBe(false);
  });

  it("pops each list item", () => {
    expect(cues.filter((c) => c.sound === "pop").map((c) => c.event)).toEqual([3.5, 4.5, 5.5]);
  });

  it("hits logo_reveal's accent with an impact", () => {
    expect(cues.filter((c) => c.sound === "impact").map((c) => c.event)).toEqual([8.6]);
  });

  it("ends a riser exactly at the start of the last scene", () => {
    const riser = cues.find((c) => c.sound === "riser")!;
    expect(riser.event).toBe(8);
    expect(riser.t).toBe(6);
  });

  it("uses each sound's default volume, sorted by start time, with no warnings", () => {
    expect(cues.find((c) => c.sound === "pop")!.vol).toBe(0.5);
    expect(cues.map((c) => c.t)).toEqual([...cues.map((c) => c.t)].sort((a, b) => a - b));
    expect(warnings).toEqual([]);
  });
});

describe("placeSfx director cues", () => {
  it("replaces the default with the same anchor and keeps the others", () => {
    const scenes = threeScenes();
    scenes[1].sfx = [{ at: "start", sound: "swoosh" }];
    const { cues } = setup(scenes, threeTimings());
    expect(cues.filter((c) => c.sceneId === "grid" && c.anchor === "start").map((c) => c.sound)).toEqual(["swoosh"]);
    expect(cues.filter((c) => c.sceneId === "grid" && c.sound === "pop")).toHaveLength(3);
  });

  it("places on_word cues on the spoken word", () => {
    const scenes = threeScenes();
    scenes[0].sfx = [{ at: "on_word", word: "Faster!", sound: "ding" }];
    const timings = threeTimings();
    timings[0].words = [{ w: "ten", text: "Ten", s: 0.3, e: 0.5 }, { w: "faster", text: "faster.", s: 0.6, e: 1.0 }];
    const { cues } = setup(scenes, timings);
    expect(cues.find((c) => c.sound === "ding")).toMatchObject({ event: 0.6, source: "director" });
  });

  it("warns and skips cues it cannot place", () => {
    const scenes = threeScenes();
    scenes[0].sfx = [{ at: "on_word", word: "missing", sound: "ding" }, { at: "end", sound: "kazoo" }];
    const { cues, warnings } = setup(scenes, threeTimings());
    expect(cues.some((c) => c.sound === "ding")).toBe(false);
    expect(warnings).toHaveLength(2);
  });

  it("drops the same sound fired twice at the same moment", () => {
    const scenes = threeScenes();
    scenes[1].sfx = [{ at: "end", sound: "whoosh" }]; // lands on the same cut as the logo's default whoosh
    const { cues } = setup(scenes, threeTimings());
    expect(cues.filter((c) => c.sound === "whoosh" && c.event === 8)).toHaveLength(1);
  });
});
