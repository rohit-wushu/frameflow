// Customizations that are part of Pro. Anyone can try them (the video renders and plays with a watermark);
// downloading a video that uses one needs Pro. `freeVoices` are the voice ids of the free tier.

interface PlanVoices {
  voice: { voiceId: string; speed: number; style?: string };
  scenes: { voiceId?: string }[];
}

export function proFeatures(plan: PlanVoices, freeVoices: Iterable<string>): string[] {
  const free = new Set(freeVoices);
  const out: string[] = [];
  if (!free.has(plan.voice.voiceId)) out.push("premium voice");
  if (plan.voice.style && plan.voice.style !== "natural") out.push("voice style");
  if (Math.abs(plan.voice.speed - 1) > 0.001) out.push("voice speed");
  if (plan.scenes.some((s) => s.voiceId && s.voiceId !== plan.voice.voiceId)) out.push("a different voice per scene");
  return out;
}
