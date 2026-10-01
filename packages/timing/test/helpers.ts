import type { Scene, ScenePlan } from "@frameflow/scene-schema";
import type { SceneVoice, TemplateTiming } from "../src/index.js";

export const templates: Record<string, TemplateTiming> = {
  hero_text: { minDuration: 2, maxDuration: 6 },
  feature_grid: { minDuration: 3, maxDuration: 8, listField: "items" },
  logo_reveal: { minDuration: 2.5, maxDuration: 5, accentAt: 0.6 },
};

export function scene(id: string, template: string, voiceover: string, estDuration: number, content: Record<string, unknown> = {}): Scene {
  return { id, template, content, voiceover, estDuration, sfx: [], transitionOut: "cut" };
}

export function makePlan(scenes: Scene[]): ScenePlan {
  return {
    id: "p",
    version: 1,
    title: "t",
    format: "16:9",
    targetDuration: 10,
    language: "en",
    mood: "energetic",
    brand: {
      name: "Acme",
      colors: { primary: "#7C5CFF", secondary: "#22D3EE", background: "#0B0B14", text: "#F5F5FA" },
      font: { heading: "Inter", body: "Inter" },
    },
    voice: { engine: "kokoro", voiceId: "af_heart", speed: 1 },
    music: { mode: "library", mood: "energetic" },
    scenes,
  };
}

// A voice of `duration` seconds whose words are spread evenly across it.
export function voice(text: string, duration: number): SceneVoice {
  const words = text.split(/\s+/);
  const step = duration / words.length;
  return { duration, words: words.map((word, i) => ({ word, start: i * step, end: (i + 0.8) * step })) };
}

export function grid(bpm: number, seconds = 60, beat0 = 0) {
  const beats: number[] = [];
  for (let t = beat0; t < seconds; t += 60 / bpm) beats.push(Math.round(t * 1e6) / 1e6);
  return { bpm, beats, downbeats: beats.filter((_, i) => i % 4 === 0) };
}
