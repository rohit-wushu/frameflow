// One line of text (+ optional website) -> finished video: brand research -> director -> engine.
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { anthropicLlm, researchBrand, slug, writePlan, type Attempt, type BrandResearch, type Language, type Llm } from "@frameflow/director";
import { BrandSchema, type Brand, type Format, type Mood } from "@frameflow/scene-schema";
import { loadMusicLibrary, loadSfxLibrary } from "./library.js";
import { makeVideo, step, type MakeVideoOptions, type MakeVideoResult } from "./make-video.js";

export interface PromptVideoOptions extends Omit<MakeVideoOptions, "plan" | "planDir"> {
  prompt: string;
  url?: string; // website to read the brand and facts from
  brandFile?: string; // an edited brand.json (from a previous research run, or hand-written)
  durationSec: number;
  format: Format;
  mood?: Mood;
  language?: Language;
  llm?: Llm; // defaults to Claude (DIRECTOR_MODEL, DIRECTOR_EFFORT)
}

export interface PromptVideoResult extends MakeVideoResult {
  research: BrandResearch | null;
  attempts: Attempt[];
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

async function loadBrandFile(path: string): Promise<{ brand: Brand; research: BrandResearch | null }> {
  const json = JSON.parse(await readFile(path, "utf8"));
  // either a full research file (brand.json from a website run) or just a brand object
  const research = json && typeof json === "object" && "brand" in json ? (json as BrandResearch) : null;
  const parsed = BrandSchema.safeParse(research ? research.brand : json);
  if (!parsed.success) throw new Error(`${path} is not a valid brand: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return { brand: parsed.data, research };
}

export async function makeVideoFromPrompt(o: PromptVideoOptions): Promise<PromptVideoResult> {
  const { storage, onEvent } = o;
  const stamp = Date.now().toString(36);

  // 1. brand: an edited brand.json wins; otherwise read the website if one was given
  const { brand, research } = await step("brand", onEvent, async () => {
    if (o.brandFile) return loadBrandFile(o.brandFile);
    if (!o.url) return { brand: null, research: null };
    const host = new URL(o.url).hostname.replace(/^www\./, "");
    const research = await researchBrand(o.url, storage.path(`research/${slug(host)}-${stamp}`));
    onEvent?.({ step: "brand", status: "info", message: `${research.brand.name}: ${Object.values(research.brand.colors).join(" ")}, ${research.brand.font.heading} / ${research.brand.font.body}${research.brand.logoUrl ? ", logo found" : ""}` });
    research.notes.forEach((n) => onEvent?.({ step: "brand", status: "warn", message: n }));
    return { brand: research.brand, research };
  });

  // 2. director: Claude writes the scene plan, validated and fixed up to 3 times
  const [sounds, tracks] = await Promise.all([loadSfxLibrary(o.assetsDir), loadMusicLibrary(o.assetsDir)]);
  const { plan, attempts } = await step("director", onEvent, async () => {
    const model = process.env.DIRECTOR_MODEL || "claude-opus-5-5";
    const llm = o.llm ?? anthropicLlm({ model, effort: (process.env.DIRECTOR_EFFORT || "medium") as Effort });
    const r = await writePlan(
      { prompt: o.prompt, durationSec: o.durationSec, format: o.format, mood: o.mood, language: o.language, brand, research },
      {
        llm,
        sounds: sounds.map((s) => ({ id: s.id, description: s.description ?? s.id })),
        musicMoods: [...new Set(tracks.flatMap((t) => t.moods))],
        onAttempt: (a) => {
          const who = a.response.fallback ? `${a.response.model} (fallback)` : a.response.model;
          const msg = a.errors.length ? `attempt ${a.n}: ${a.errors.length} problem(s) sent back to fix` : `attempt ${a.n}: plan accepted`;
          onEvent?.({ step: "director", status: "info", message: `${msg} [${who}, ${(a.ms / 1000).toFixed(0)}s, ${a.response.usage.output} tokens out]` });
        },
      },
    );
    await storage.writeJson(`projects/${r.plan.id}/v${r.plan.version}/director.json`, { prompt: o.prompt, url: o.url ?? null, research, attempts: r.attempts });
    onEvent?.({ step: "director", status: "info", message: `"${r.plan.title}": ${r.plan.scenes.map((s) => s.template).join(" → ")}` });
    return r;
  });

  // 3. the engine from phase 1
  const planDir = o.brandFile ? dirname(o.brandFile) : storage.root; // for a relative logoUrl in a brand file
  const result = await makeVideo({ ...o, plan, planDir });
  return { ...result, research, attempts };
}
