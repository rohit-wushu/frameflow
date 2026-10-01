import { describe, expect, it } from "vitest";
import { proFeatures } from "../src/index.js";

const free = ["af_heart", "pr_ta_jaya"];
const plan = (voice: { voiceId: string; speed?: number; style?: string }, scenes: { voiceId?: string }[] = [{}, {}]) => ({ voice: { speed: 1, ...voice }, scenes });

describe("proFeatures", () => {
  it("a free voice with no changes is free", () => expect(proFeatures(plan({ voiceId: "af_heart" }), free)).toEqual([]));
  it("the natural style is not a customization", () => expect(proFeatures(plan({ voiceId: "pr_ta_jaya", style: "natural" }), free)).toEqual([]));
  it("a premium voice", () => expect(proFeatures(plan({ voiceId: "pr_hi_rohit" }), free)).toEqual(["premium voice"]));
  it("style and speed", () => expect(proFeatures(plan({ voiceId: "pr_ta_jaya", style: "calm", speed: 1.1 }), free)).toEqual(["voice style", "voice speed"]));
  it("a scene in another voice", () => expect(proFeatures(plan({ voiceId: "af_heart" }, [{}, { voiceId: "am_michael" }]), free)).toEqual(["a different voice per scene"]));
  it("a scene repeating the plan's voice is not a customization", () => expect(proFeatures(plan({ voiceId: "af_heart" }, [{ voiceId: "af_heart" }]), free)).toEqual([]));
});
