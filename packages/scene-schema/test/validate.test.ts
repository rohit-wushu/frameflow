import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeWord, spokenWordCount, validatePlan, type ValidationContext } from "../src/index.js";

const ctx: ValidationContext = {
  templates: {
    hero_text: { category: "hook", minDuration: 2, maxDuration: 6, schema: z.object({ headline: z.string().max(20) }) },
    feature_grid: {
      category: "content",
      minDuration: 3,
      maxDuration: 8,
      schema: z.object({ items: z.array(z.object({ title: z.string() })).min(2).max(4) }),
    },
    cta: { category: "end", minDuration: 2, maxDuration: 6, schema: z.object({ headline: z.string() }) },
    logo_reveal: { category: "end", minDuration: 2, maxDuration: 6, schema: z.object({ tagline: z.string().optional() }) },
  },
  sfxIds: ["whoosh", "pop", "impact"],
};

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    version: 1,
    title: "Test",
    format: "16:9",
    targetDuration: 12,
    language: "en",
    mood: "energetic",
    brand: {
      name: "Acme",
      colors: { primary: "#7C5CFF", secondary: "#22D3EE", background: "#0B0B14", text: "#F5F5FA" },
      font: { heading: "Inter", body: "Inter" },
    },
    voice: { engine: "kokoro", voiceId: "af_heart", speed: 1 },
    music: { mode: "library", mood: "energetic" },
    scenes: [
      { id: "s1", template: "hero_text", content: { headline: "Hello" }, voiceover: "Say hello.", estDuration: 3, transitionOut: "cut" },
      {
        id: "s2",
        template: "feature_grid",
        content: { items: [{ title: "A" }, { title: "B" }] },
        voiceover: "Two things matter.",
        estDuration: 5,
        sfx: [{ at: "on_word", word: "things", sound: "pop" }],
        transitionOut: "fade",
      },
      { id: "s3", template: "logo_reveal", content: {}, voiceover: "", estDuration: 4, transitionOut: "cut" },
    ],
    ...overrides,
  };
}

function scenes(p: ReturnType<typeof plan>) {
  return p.scenes as Array<Record<string, unknown>>;
}

function errorsOf(input: unknown) {
  const r = validatePlan(input, ctx);
  return r.ok ? [] : r.errors;
}

describe("validatePlan", () => {
  it("accepts a valid plan and fills defaults", () => {
    const r = validatePlan(plan(), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.scenes[0].sfx).toEqual([]);
  });

  it("rejects bad top-level fields with a readable path", () => {
    const p = plan();
    p.brand.colors.primary = "violet";
    expect(errorsOf(p)[0]).toMatchObject({ path: "brand.colors.primary" });
  });

  it("rejects unknown templates", () => {
    const p = plan();
    scenes(p)[1].template = "spinning_cube";
    expect(errorsOf(p).map((e) => e.path)).toContain("scenes[1].template");
  });

  it("checks content against the template's own schema", () => {
    const p = plan();
    scenes(p)[0].content = { headline: "This headline is far too long" };
    expect(errorsOf(p)).toContainEqual(expect.objectContaining({ path: "scenes[0].content.headline" }));
  });

  it("checks each scene's duration against the template limits", () => {
    const p = plan({ targetDuration: 16 });
    scenes(p)[1].estDuration = 9;
    expect(errorsOf(p)).toContainEqual(expect.objectContaining({ path: "scenes[1].estDuration" }));
  });

  it("requires the total to be within 15% of the target", () => {
    expect(errorsOf(plan({ targetDuration: 12 }))).toEqual([]);
    expect(errorsOf(plan({ targetDuration: 13.8 }))).toEqual([]); // 12 / 13.8 = -13%
    expect(errorsOf(plan({ targetDuration: 15 })).map((e) => e.path)).toEqual(["scenes"]); // -20%
    expect(errorsOf(plan({ targetDuration: 10 })).map((e) => e.path)).toEqual(["scenes"]); // +20%
  });

  it("requires a hook first and logo_reveal or cta last", () => {
    const p = plan();
    const s = scenes(p);
    [s[0], s[1]] = [s[1], s[0]];
    expect(errorsOf(p).map((e) => e.path)).toContain("scenes[0].template");

    const q = plan();
    scenes(q)[2] = { ...scenes(q)[1], id: "s3" };
    scenes(q)[1] = { ...scenes(q)[0], id: "s2" };
    expect(errorsOf(q).map((e) => e.path)).toContain("scenes[2].template");
  });

  it("rejects the same template twice in a row", () => {
    const p = plan({ targetDuration: 15 });
    scenes(p).splice(1, 0, { ...scenes(p)[0], id: "s1b" });
    expect(errorsOf(p)).toContainEqual(expect.objectContaining({ path: "scenes[1].template" }));
  });

  it("rejects unknown sounds and on_word cues for words that are not spoken", () => {
    const p = plan();
    scenes(p)[1].sfx = [
      { at: "start", sound: "kazoo" },
      { at: "on_word", word: "banana", sound: "pop" },
      { at: "on_word", sound: "pop" },
    ];
    const paths = errorsOf(p).map((e) => e.path);
    expect(paths).toContain("scenes[1].sfx[0].sound");
    expect(paths).toContain("scenes[1].sfx[2].word"); // schema-level: missing word
  });

  it("matches on_word cues ignoring case and punctuation", () => {
    const p = plan();
    scenes(p)[1].sfx = [{ at: "on_word", word: "Matter", sound: "pop" }];
    expect(errorsOf(p)).toEqual([]);
  });

  describe("speech pacing (director output)", () => {
    const speech = { rates: { af_heart: 3 }, defaultRate: 2.5, pause: 0.25, overhead: 0.5 };

    it("accepts voiceovers that match their estDuration", () => {
      // "Two things matter." = 3 words -> 1s + 0.5 overhead, clamped up to feature_grid's 3s minimum
      const p = plan();
      scenes(p)[1].estDuration = 3;
      scenes(p)[2].estDuration = 6; // keep the total at 12s
      expect(validatePlan(p, { ...ctx, speech }).ok).toBe(true);
    });

    it("flags a voiceover too long for its template, with how much to cut", () => {
      const p = plan();
      scenes(p)[0].voiceover = Array(20).fill("word").join(" "); // 20 / 3 + 0.5 = 7.2s > 6 - 0.5 margin
      expect(errorsOf({ ...p })).toEqual([]); // no pacing rules without a speech model
      const r = validatePlan(p, { ...ctx, speech });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors).toContainEqual({ path: "scenes[0].voiceover", message: expect.stringMatching(/cut about 6 word/) });
    });

    it("counts numbers as the words they are read as", () => {
      const p = plan();
      scenes(p)[0].voiceover = "We have 41.8k stars and 1,250,000 users since 1998."; // 3 + 5 + 2 + 7 + 1 + 3 = 21 spoken words
      const r = validatePlan(p, { ...ctx, speech });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((x) => x.path)).toContain("scenes[0].voiceover");
    });

    it("flags an estDuration that does not match the spoken length", () => {
      const r = validatePlan(plan(), { ...ctx, speech }); // scene 1 is ~3s but estDuration 5
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((x) => x.path)).toEqual(["scenes[1].estDuration"]);
    });
  });

  describe("spokenWordCount", () => {
    it("reads numbers the way the narrator says them", () => {
      expect(spokenWordCount("hello,")).toBe(1);
      expect(spokenWordCount("41.8k")).toBe(5); // forty one point eight thousand
      expect(spokenWordCount("$30")).toBe(2); // thirty dollars
      expect(spokenWordCount("62%")).toBe(3); // sixty two percent
      expect(spokenWordCount("100")).toBe(2); // one hundred
      expect(spokenWordCount("1998")).toBe(3); // nineteen ninety eight
      expect(spokenWordCount("10,000")).toBe(2); // ten thousand
    });
  });

  it("rejects duplicate scene ids", () => {
    const p = plan();
    scenes(p)[2].id = "s1";
    expect(errorsOf(p).map((e) => e.path)).toContain("scenes[2].id");
  });
});

describe("normalizeWord", () => {
  it("keeps Devanagari vowel signs, so different Hindi words stay different", () => {
    expect(normalizeWord("कि")).not.toBe(normalizeWord("का"));
    expect(normalizeWord("वीडियो,")).toBe("वीडियो");
    expect(normalizeWord("Beat,")).toBe("beat");
  });
});
