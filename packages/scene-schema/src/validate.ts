import type { z } from "zod";
import { END_TEMPLATES, ScenePlanSchema, type ScenePlan } from "./plan";
import { normalizeWord, speechSeconds, voiceWords, type SpeechModel } from "./words";

// What the validator needs to know about each template (the registry provides it).
export interface TemplateRules {
  category: "hook" | "content" | "end";
  minDuration: number;
  maxDuration: number;
  schema: z.ZodType;
}

export interface ValidationContext {
  templates: Record<string, TemplateRules>;
  sfxIds: Iterable<string>;
  // false skips the whole-video rules (total duration, hook first, end last, no repeats):
  // used for single-scene template previews
  planRules?: boolean;
  // When set, each voiceover is checked against its scene length with this speech model (per-voice
  // speaking rates measured from Kokoro, pauses, scene overhead). Used for director output.
  speech?: SpeechModel;
}

const EST_TOLERANCE = 1.2; // seconds a scene's estDuration may differ from its spoken length
const SPEECH_MARGIN = 0.5; // the estimate can be ~1 s short; keep this much headroom under a template's max

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult = { ok: true; plan: ScenePlan } | { ok: false; errors: ValidationIssue[] };

const DURATION_TOLERANCE = 0.15;
export const FOCUS_ANYWHERE = ["center", "top"]; // zoom targets every image has

function joinPath(parts: PropertyKey[]): string {
  return parts.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("").replace(/^\./, "");
}

// Validate a plan against the Zod schema, each template's content schema, and the plan rules.
// All problems are reported in one pass (even when the base schema fails), and the messages
// are written so they can be sent back to the director as-is.
export function validatePlan(input: unknown, ctx: ValidationContext): ValidationResult {
  const parsed = ScenePlanSchema.safeParse(input);
  const errors: ValidationIssue[] = parsed.success
    ? []
    : parsed.error.issues.map((i) => ({ path: joinPath(i.path), message: i.message }));
  // Rule checks run on the parsed plan, or best-effort on the raw input so every error shows up at once.
  const plan = parsed.success ? structuredClone(parsed.data) : (input as ScenePlan);
  if (plan && Array.isArray(plan.scenes) && plan.scenes.length && plan.scenes.every((s) => s && typeof s === "object")) {
    checkRules(plan, ctx, errors);
  }
  return errors.length ? { ok: false, errors: dedupe(errors) } : { ok: true, plan };
}

function checkRules(plan: ScenePlan, ctx: ValidationContext, errors: ValidationIssue[]) {
  const sfxIds = new Set(ctx.sfxIds);
  const add = (path: string, message: string) => errors.push({ path, message });

  const seenIds = new Set<string>();
  plan.scenes.forEach((scene, i) => {
    const at = `scenes[${i}]`;
    if (seenIds.has(scene.id)) add(`${at}.id`, `duplicate scene id "${scene.id}"`);
    seenIds.add(scene.id);

    const template = ctx.templates[scene.template];
    if (!template) {
      add(`${at}.template`, `unknown template "${scene.template}"; available: ${Object.keys(ctx.templates).join(", ")}`);
    } else {
      const content = template.schema.safeParse(scene.content);
      if (content.success) scene.content = content.data as Record<string, unknown>;
      else for (const issue of content.error.issues) add(`${at}.content${issue.path.length ? "." : ""}${joinPath(issue.path)}`, issue.message);

      if (typeof scene.estDuration === "number" && (scene.estDuration < template.minDuration || scene.estDuration > template.maxDuration)) {
        add(`${at}.estDuration`, `${scene.estDuration}s is outside ${scene.template}'s range of ${template.minDuration}-${template.maxDuration}s`);
      }

      // the real scene length comes from the voice, so the voiceover must fit the scene
      const vo = typeof scene.voiceover === "string" ? scene.voiceover.trim() : "";
      if (ctx.speech && vo && typeof scene.estDuration === "number") {
        const voiceId = typeof plan.voice?.voiceId === "string" ? plan.voice.voiceId : "";
        const speed = typeof plan.voice?.speed === "number" ? plan.voice.speed : 1;
        const spoken = speechSeconds(vo, voiceId, speed, ctx.speech) + ctx.speech.overhead;
        if (spoken + SPEECH_MARGIN > template.maxDuration) {
          const rate = (ctx.speech.rates[voiceId] ?? ctx.speech.defaultRate) * speed;
          const cut = Math.max(1, Math.ceil((spoken + SPEECH_MARGIN - template.maxDuration) * rate));
          add(`${at}.voiceover`, `this takes about ${spoken.toFixed(1)}s with the ${voiceId || "chosen"} voice, too long for ${scene.template}'s ${template.maxDuration}s maximum; cut about ${cut} word(s) (numbers count as the words they are read as)`);
        } else {
          const predicted = Math.max(spoken, template.minDuration);
          if (Math.abs(predicted - scene.estDuration) > EST_TOLERANCE) {
            add(`${at}.estDuration`, `the voiceover will run about ${predicted.toFixed(1)}s but estDuration is ${scene.estDuration}s; set estDuration to about ${predicted.toFixed(1)} or change the voiceover length`);
          }
        }
      }
    }

    // images are referenced by name; a zoom target must be a named region of that image
    const content = scene.content && typeof scene.content === "object" ? (scene.content as Record<string, unknown>) : {};
    if (typeof content.image === "string") {
      const assets = plan.assets && typeof plan.assets === "object" ? plan.assets : {};
      const asset = assets[content.image];
      const names = Object.keys(assets);
      if (!asset) add(`${at}.content.image`, names.length ? `"${content.image}" is not an available image; use one of ${names.join(", ")}` : `there are no images for this video, so ${scene.template} can't be used; pick another template`);
      else if (typeof content.focus === "string" && !FOCUS_ANYWHERE.includes(content.focus) && !asset.regions?.[content.focus]) {
        const regions = [...FOCUS_ANYWHERE, ...Object.keys(asset.regions ?? {})];
        add(`${at}.content.focus`, `"${content.focus}" is not a region of "${content.image}"; use one of ${regions.join(", ")}`);
      }
    }

    if (ctx.planRules !== false && i > 0 && plan.scenes[i - 1].template === scene.template) {
      add(`${at}.template`, `"${scene.template}" is used twice in a row (scenes ${i - 1} and ${i}); use a different template`);
    }

    const spoken = new Set(voiceWords(typeof scene.voiceover === "string" ? scene.voiceover : ""));
    (Array.isArray(scene.sfx) ? scene.sfx : []).forEach((cue, j) => {
      if (!cue || typeof cue !== "object") return;
      if (!sfxIds.has(cue.sound)) add(`${at}.sfx[${j}].sound`, `unknown sound "${cue.sound}"; available: ${[...sfxIds].join(", ")}`);
      if (cue.at === "on_word" && typeof cue.word === "string" && !spoken.has(normalizeWord(cue.word))) {
        add(`${at}.sfx[${j}].word`, `"${cue.word}" is not spoken in this scene's voiceover`);
      }
    });
  });

  if (ctx.planRules === false) return;

  const total = plan.scenes.reduce((sum, s) => sum + (typeof s.estDuration === "number" ? s.estDuration : 0), 0);
  if (typeof plan.targetDuration === "number") {
    const low = plan.targetDuration * (1 - DURATION_TOLERANCE);
    const high = plan.targetDuration * (1 + DURATION_TOLERANCE);
    if (total < low || total > high) {
      add("scenes", `estDuration adds up to ${total.toFixed(1)}s; it must be within ±15% of targetDuration ${plan.targetDuration}s (${low.toFixed(1)}-${high.toFixed(1)}s)`);
    }
  }

  const first = plan.scenes[0];
  if (ctx.templates[first.template] && ctx.templates[first.template].category !== "hook") {
    const hooks = Object.entries(ctx.templates).filter(([, t]) => t.category === "hook").map(([name]) => name);
    add("scenes[0].template", `the first scene must be a hook template (${hooks.join(", ")}), not "${first.template}"`);
  }
  const last = plan.scenes[plan.scenes.length - 1];
  if (!(END_TEMPLATES as readonly string[]).includes(last.template)) {
    add(`scenes[${plan.scenes.length - 1}].template`, `the last scene must be ${END_TEMPLATES.join(" or ")}, not "${last.template}"`);
  }
}

function dedupe(errors: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.path}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatIssues(errors: ValidationIssue[]): string {
  return errors.map((e) => `- ${e.path}: ${e.message}`).join("\n");
}
