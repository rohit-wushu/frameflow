import { speechSeconds } from "@frameflow/scene-schema";
import { templates } from "@frameflow/templates";
import { describe, expect, it } from "vitest";
import { extractJson, pinFields, revisePlan, SPEECH, writePlan, type Brief, type Llm, type LlmRequest } from "../src/index.js";

const brand = {
  name: "Frameflow",
  colors: { primary: "#7C5CFF", secondary: "#22D3EE", background: "#0B0B14", text: "#F5F5FA" },
  font: { heading: "Space Grotesk", body: "Inter" },
};
const sounds = ["whoosh", "swoosh", "riser", "impact", "pop", "click", "ding"].map((id) => ({ id, description: id }));

// A plan the validator accepts: the template examples, with estDurations matching their voiceovers.
function goodDraft(voiceId = "af_heart") {
  const scenes = ["hero_text", "feature_grid", "stat_counter", "cta", "logo_reveal"].map((name) => {
    const t = templates[name];
    const spoken = speechSeconds(t.example.voiceover, voiceId, 1, SPEECH) + SPEECH.overhead;
    const est = Math.round(Math.max(spoken, t.meta.minDuration) * 10) / 10;
    return { id: name, template: name, content: structuredClone(t.example.content), voiceover: t.example.voiceover, estDuration: est, sfx: [], transitionOut: "cut" };
  });
  return {
    title: "Frameflow intro",
    mood: "energetic",
    brand: { ...brand, name: "Something else" },
    voice: { engine: "kokoro", voiceId, speed: 1 },
    music: { mode: "generate", mood: "energetic" },
    scenes,
  };
}
const total = (d: ReturnType<typeof goodDraft>) => d.scenes.reduce((s, x) => s + x.estDuration, 0);
// the same plan with a real voice that also speaks at the default rate (so the durations still match)
const fixedVoice = () => ({ ...goodDraft("robot_9000"), voice: { engine: "kokoro", voiceId: "am_fenrir", speed: 1 } });
const brief = (voiceId = "af_heart"): Brief => ({ prompt: "An intro video for Frameflow", durationSec: Math.round(total(goodDraft(voiceId))), format: "9:16", brand });

function fakeLlm(replies: string[]): Llm & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  const llm = (async (req: LlmRequest) => {
    calls.push(req);
    const text = replies[Math.min(calls.length - 1, replies.length - 1)];
    return { text, model: "fake", fallback: false, usage: { input: 0, output: 0, cacheRead: 0 } };
  }) as Llm & { calls: LlmRequest[] };
  llm.calls = calls;
  return llm;
}

describe("extractJson", () => {
  it("reads a bare object, a fenced one, and one with a stray sentence", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":{"b":2}}\n```')).toEqual({ a: { b: 2 } });
    expect(extractJson('Here you go:\n{"a":1}\nEnjoy.')).toEqual({ a: 1 });
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("pinFields", () => {
  it("keeps the user's choices over the director's", () => {
    const p = pinFields(goodDraft(), { ...brief(), mood: "calm" }, "id-1");
    expect(p).toMatchObject({ id: "id-1", version: 1, format: "9:16", language: "en", mood: "calm", brand, music: { mode: "library" } });
  });
});

describe("writePlan", () => {
  it("returns a valid plan on the first try", async () => {
    const llm = fakeLlm([JSON.stringify(goodDraft())]);
    const { plan, attempts } = await writePlan(brief(), { llm, sounds, musicMoods: ["energetic"] });
    expect(attempts).toHaveLength(1);
    expect(plan.brand.name).toBe("Frameflow");
    expect(plan.format).toBe("9:16");
    expect(llm.calls[0].system).toContain("## feature_grid"); // the catalog is in the prompt
  });

  it("sends the exact errors back and accepts the fixed plan", async () => {
    const bad = goodDraft("robot_9000");
    (bad.scenes[1].content as { items: { icon: string }[] }).items[0].icon = "not-a-real-icon";
    const llm = fakeLlm(["```json\n" + JSON.stringify(bad) + "\n```", JSON.stringify(fixedVoice())]);
    const seen: number[] = [];
    const { attempts } = await writePlan(brief("robot_9000"), { llm, sounds, musicMoods: ["energetic"], onAttempt: (a) => seen.push(a.errors.length) });
    expect(attempts).toHaveLength(2);
    expect(seen).toEqual([1, 0]); // the icon (the voice is only checked once the schema passes)
    expect(llm.calls[1].user).toContain("scenes[1].content.items[0].icon");
    expect(llm.calls[1].user).toContain("You wrote this plan:");
  });

  it("recovers from a reply that is not JSON", async () => {
    const llm = fakeLlm(["Sorry, here is the plan in prose.", JSON.stringify(goodDraft())]);
    const { attempts } = await writePlan(brief(), { llm, sounds, musicMoods: ["energetic"] });
    expect(attempts[0].errors[0].path).toBe("(reply)");
    expect(attempts).toHaveLength(2);
  });

  it("gives up after 3 attempts with a readable error", async () => {
    const bad = goodDraft();
    bad.scenes.reverse(); // logo first, hero last
    const llm = fakeLlm([JSON.stringify(bad)]);
    await expect(writePlan(brief(), { llm, sounds, musicMoods: ["energetic"] })).rejects.toThrow(/could not write a valid plan in 3 attempts[\s\S]*hook template/);
    expect(llm.calls).toHaveLength(3);
  });

  it("checks the voice once the rest is valid", async () => {
    const bad = goodDraft("robot_9000");
    const llm = fakeLlm([JSON.stringify(bad), JSON.stringify(fixedVoice())]);
    const { attempts } = await writePlan(brief("robot_9000"), { llm, sounds, musicMoods: ["energetic"] });
    expect(attempts[0].errors).toEqual([expect.objectContaining({ path: "voice.voiceId" })]);
  });
});

describe("revisePlan (chat edits)", () => {
  const current = () => ({ ...pinFields(goodDraft(), brief(), "p-1"), brand: { ...brand, logoUrl: "uploads/u1/logo.png" }, version: 3 });
  const opts = (llm: Llm) => ({ llm, sounds, musicMoods: ["energetic"] });

  it("applies the change and keeps what chat can't change (id, version, format, logo)", async () => {
    const edited = structuredClone(current()) as ReturnType<typeof current> & { scenes: { textScale?: number }[] };
    edited.scenes[1].textScale = 1.25;
    const sneaky = { ...edited, id: "other", version: 9, format: "16:9", brand: { ...brand, logoUrl: "/etc/passwd" } };
    const llm = fakeLlm([JSON.stringify({ summary: "Made scene 2's text bigger.", plan: sneaky })]);
    const r = await revisePlan({ plan: current(), instruction: "make scene 2 text bigger", sceneId: "feature_grid" }, opts(llm));
    expect(r.summary).toBe("Made scene 2's text bigger.");
    expect(r.plan.scenes[1].textScale).toBe(1.25);
    expect(r.plan).toMatchObject({ id: "p-1", version: 3, format: "9:16", brand: { logoUrl: "uploads/u1/logo.png" } });
    expect(llm.calls[0].user).toContain('The user has scene 2 selected (id "feature_grid"');
    expect(llm.calls[0].user).toContain('"make scene 2 text bigger"');
  });

  it("sends problems back and accepts the fix", async () => {
    const bad = structuredClone(current()) as ReturnType<typeof current> & { scenes: { textScale?: number }[] };
    bad.scenes[1].textScale = 2;
    const good = structuredClone(bad);
    good.scenes[1].textScale = 1.4;
    const llm = fakeLlm([JSON.stringify({ summary: "Bigger.", plan: bad }), JSON.stringify({ summary: "Bigger.", plan: good })]);
    const r = await revisePlan({ plan: current(), instruction: "much bigger text", sceneId: "feature_grid" }, opts(llm));
    expect(r.attempts).toHaveLength(2);
    expect(llm.calls[1].user).toContain("scenes[1].textScale");
    expect(r.plan.scenes[1].textScale).toBe(1.4);
  });

  it("asks again when the answer has no plan object", async () => {
    const llm = fakeLlm([JSON.stringify({ summary: "Done" }), JSON.stringify({ summary: "Calmer music.", plan: { ...current(), music: { mode: "library", mood: "calm" } } })]);
    const r = await revisePlan({ plan: current(), instruction: "calmer music" }, opts(llm));
    expect(r.attempts[0].errors[0].path).toBe("plan");
    expect(r.plan.music.mood).toBe("calm");
  });
});
