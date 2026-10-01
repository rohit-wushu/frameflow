import { LANGUAGES, voiceEngine } from "@frameflow/scene-schema";
import { describe, expect, it } from "vitest";
import { briefMessage, languageNote, pinFields, VOICES, voicesFor } from "../src/index.js";

describe("voices for every language", () => {
  it.each(LANGUAGES)("%s has a free voice", (l) => expect(voicesFor(l, "free").length).toBeGreaterThan(0));
  it("Hinglish is spoken by the Hindi voices", () => expect(voicesFor("hinglish").map((v) => v.id)).toEqual(voicesFor("hi").map((v) => v.id)));
  it("voice ids are unique and their engine follows the id", () => {
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(VOICES.length);
    for (const v of VOICES) expect(voiceEngine(v.id)).toBe(v.engine);
  });
  it("Indic Parler ids are pr_<language>_<lowercase speaker>", () => {
    for (const v of VOICES.filter((x) => x.engine === "indic-parler")) expect(v.id).toMatch(/^pr_[a-z]+_[a-z]+$/);
  });
  it("the brief names the language, its script and only free voices", () => {
    const msg = briefMessage({ prompt: "Launch video", durationSec: 30, format: "16:9", language: "ta" });
    expect(msg).toContain("Tamil");
    expect(msg).toContain("Tamil script");
    expect(msg).toContain("pr_ta_jaya");
    expect(msg).not.toContain("pr_ta_kavitha");
  });
  it("Hinglish keeps its own note", () => expect(languageNote("hinglish")).toContain("Devanagari"));
  it("a voice the user chose is named in the brief and pinned in the plan", () => {
    const brief = { prompt: "Launch video", durationSec: 30, format: "16:9" as const, language: "ta" as const, voiceId: "pr_ta_kavitha" };
    expect(briefMessage(brief)).toContain("Voice: pr_ta_kavitha (the user chose it");
    const plan = pinFields({ voice: { engine: "kokoro", voiceId: "af_heart", speed: 1 } }, brief, "x");
    expect(plan.voice).toEqual({ engine: "indic-parler", voiceId: "pr_ta_kavitha", speed: 1 });
  });
});
