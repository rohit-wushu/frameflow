// pnpm templates:preview [name ...]
// Renders every template (or the named ones) with its example.json into <template>/preview.mp4,
// then takes 9:16 and 1:1 stills of the same scene to check the responsive layouts.
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { FORMAT_SIZE, type Format } from "@frameflow/scene-schema";
import { templates } from "@frameflow/templates";
import type { CaptionChunk, TimingResult } from "@frameflow/timing";
import { ensureAudioService } from "./audio-client.js";
import { createContext } from "./context.js";
import { makeVideo, resolveImages } from "./make-video.js";

const BRAND = {
  name: "Frameflow",
  colors: { primary: "#7C5CFF", secondary: "#22D3EE", background: "#0B0B14", text: "#F5F5FA" },
  font: { heading: "Space Grotesk", body: "Inter" },
};

async function main() {
  const ctx = createContext();
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(templates);
  const stopAudio = await ensureAudioService(ctx.audio, ctx.root, ctx.storage.path("audio-service.log"), (m) => console.log(`· ${m}`));
  const results: { name: string; ok: boolean; detail: string }[] = [];
  try {
    for (const name of names) {
      const t = templates[name];
      if (!t) throw new Error(`unknown template "${name}"`);
      process.stdout.write(`${name.padEnd(14)} `);
      const plan = {
        id: `preview-${name}`,
        version: 1,
        title: `${name} preview`,
        format: "16:9",
        targetDuration: t.example.estDuration,
        language: "en",
        mood: "energetic",
        brand: BRAND,
        voice: { engine: "kokoro", voiceId: "af_heart", speed: 1 },
        music: { mode: "library", mood: "energetic" },
        scenes: [{ id: name, template: name, content: t.example.content, voiceover: t.example.voiceover, estDuration: t.example.estDuration, sfx: [], transitionOut: "cut" }],
        ...(t.example.assets ? { assets: t.example.assets } : {}),
      };
      try {
        const outKey = `previews/${name}`;
        const r = await makeVideo({ plan, planDir: t.dir, preview: true, outKey, quality: "draft", social: false, ...ctx });
        await copyFile(r.video, join(t.dir, "preview.mp4"));
        const failed = r.qa.checks.filter((c) => !c.ok && c.name !== "cuts on the beat");

        // same scene in the other two formats, as stills
        const timing = await ctx.storage.readJson<TimingResult>(`${outKey}/timing.json`);
        const captions = await ctx.storage.readJson<CaptionChunk[]>(`${outKey}/captions.json`);
        const at = Math.min(timing.duration - 0.7, Math.max(1.5, timing.duration * 0.75));
        for (const format of ["9:16", "1:1"] as Format[]) {
          const slug = format.replace(":", "x");
          await ctx.renderer.snapshot({
            plan: { ...r.plan, format },
            timing,
            captions,
            burnCaptions: false,
            mixFile: ctx.storage.path(`${outKey}/mix.m4a`),
            logoFile: null,
            images: await resolveImages(r.plan, t.dir, ctx.storage),
            workDir: ctx.storage.path(`${outKey}/work-${slug}`),
            times: [at],
            outDir: ctx.storage.path(`${outKey}/stills-${slug}`),
          });
        }
        const ok = failed.length === 0;
        const detail = ok ? `ok (${timing.duration.toFixed(1)}s; stills in storage/${outKey})` : failed.map((c) => `${c.name}: ${c.detail}`).join("; ");
        results.push({ name, ok, detail });
        console.log(detail);
      } catch (e) {
        results.push({ name, ok: false, detail: (e as Error).message });
        console.log(`FAILED: ${(e as Error).message}`);
      }
    }
  } finally {
    stopAudio();
  }
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} template previews passed (${Object.keys(FORMAT_SIZE).join(", ")} checked)`);
  if (bad.length) process.exit(1);
}

main().catch((e: Error) => {
  console.error(e.stack ?? e.message);
  process.exit(1);
});
