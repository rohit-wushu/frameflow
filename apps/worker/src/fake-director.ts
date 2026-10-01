// A stand-in for Claude, for testing the app end to end without an API key (DIRECTOR_FAKE=1).
// It is not a director: new plans are stitched from the template examples, and edits follow a few
// keyword rules ("bigger", "smaller", "calmer", "voice"). Never enable it for real users.
import { SPEECH, type Llm } from "@frameflow/director";
import { speechSeconds } from "@frameflow/scene-schema";
import { templates } from "@frameflow/templates";

const scene = (name: string, n: number, voiceId: string) => {
  const t = templates[name];
  const spoken = speechSeconds(t.example.voiceover, voiceId, 1, SPEECH) + SPEECH.overhead;
  const est = Math.round(Math.min(Math.max(spoken, t.meta.minDuration), t.meta.maxDuration) * 10) / 10;
  return { id: `${name.replace("_", "-")}-${n}`, template: name, content: structuredClone(t.example.content), voiceover: t.example.voiceover, estDuration: est, sfx: [], transitionOut: n % 2 ? "slide" : "cut" };
};

function newPlan(user: string): string {
  const title = /^Brief: (.*)$/m.exec(user)?.[1]?.slice(0, 80) ?? "Fake plan";
  const target = Number(/^Length: (\d+) seconds/m.exec(user)?.[1] ?? 30);
  const voiceId = "af_heart";
  const middles = ["feature_grid", "stat_counter"];
  const end = [scene("cta", 90, voiceId), scene("logo_reveal", 91, voiceId)];
  const scenes = [scene("hero_text", 0, voiceId)];
  // with website images, zoom into the screenshot (on its main button when one was found)
  const site = /^- website: .*?(?:zoom regions: (.*))?$/m.exec(user);
  if (site) {
    const zoom = scene("screenshot_zoom", 50, voiceId);
    zoom.content = { image: "website", focus: site[1]?.split(", ").includes("button") ? "button" : "center", title: "Straight from your website" };
    scenes.push(zoom);
  }
  const total = () => [...scenes, ...end].reduce((s, x) => s + x.estDuration, 0);
  for (let i = 0; total() < target * 0.9 && i < 12; i++) scenes.push(scene(middles[i % 2], i + 1, voiceId));
  return JSON.stringify({
    title,
    mood: "energetic",
    brand: { name: "Fake Co", colors: { primary: "#7C5CFF", secondary: "#22D3EE", background: "#0B0B14", text: "#F5F5FA" }, font: { heading: "Space Grotesk", body: "Inter" } },
    voice: { engine: "kokoro", voiceId, speed: 1 },
    music: { mode: "library", mood: "energetic" },
    scenes: [...scenes, ...end],
  });
}

function edit(user: string): string {
  const start = user.indexOf("{");
  const end = user.indexOf("\n\nThe user");
  const plan = JSON.parse(user.slice(start, end));
  const instruction = (/^The user asks: (.*)$/m.exec(user)?.[1] ?? "").toLowerCase();
  const sceneId = /\(id "([^"]+)"/.exec(user)?.[1];
  const target = plan.scenes.find((s: { id: string }) => s.id === sceneId) ?? plan.scenes[0];
  let summary = "I couldn't tell what to change (fake director).";
  if (/bigger|larger/.test(instruction)) {
    target.textScale = 1.3;
    summary = `Made the text in "${target.id}" bigger.`;
  } else if (/smaller/.test(instruction)) {
    target.textScale = 0.8;
    summary = `Made the text in "${target.id}" smaller.`;
  } else if (/calm/.test(instruction)) {
    plan.music.mood = "calm";
    summary = "Switched to calmer music.";
  } else if (/voice/.test(instruction)) {
    // two voices with about the same pace, so the scene durations still match
    plan.voice.voiceId = plan.voice.voiceId === "af_heart" ? "am_puck" : "af_heart";
    summary = `Changed the voice to ${plan.voice.voiceId}.`;
  }
  return JSON.stringify({ summary, plan });
}

export function fakeDirector(): Llm {
  return async ({ user }) => ({
    text: user.includes("This is the current scene plan of a video:") ? edit(user) : newPlan(user),
    model: "fake-director",
    fallback: false,
    usage: { input: 0, output: 0, cacheRead: 0 },
  });
}
