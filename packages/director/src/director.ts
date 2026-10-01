// The AI director: brief (+ brand) -> scene plan, with a validation loop.
// Claude writes the plan as JSON; our validator checks it; on failure the exact errors go back
// to Claude to fix (fresh request with the previous plan), up to 3 attempts in total.
import { formatIssues, validatePlan, type ScenePlan, type SpeechModel, type ValidationIssue } from "@frameflow/scene-schema";
import { templateRules } from "@frameflow/templates";
import { TIMING_DEFAULTS } from "@frameflow/timing";
import { isGoogleFont } from "./google-fonts.js";
import { researchAssets } from "./brand.js";
import { DirectorError, type Llm, type LlmResponse } from "./llm.js";
import { DEFAULT_RATE, PAUSE_SECONDS, VOICES, voicesFor } from "./options.js";
import { briefMessage, editFixMessage, editMessage, fixMessage, systemPrompt, type Brief, type EditRequest, type Sound } from "./prompt.js";

export interface Attempt {
  n: number;
  response: Omit<LlmResponse, "text">;
  raw: string;
  errors: ValidationIssue[];
  ms: number;
}

export interface DirectorOptions {
  llm: Llm;
  sounds: Sound[];
  musicMoods: string[];
  maxAttempts?: number;
  onAttempt?: (a: Attempt) => void;
}

export const SPEECH: SpeechModel = {
  rates: Object.fromEntries(VOICES.flatMap((v) => (v.rate ? [[v.id, v.rate]] : []))),
  defaultRate: DEFAULT_RATE,
  pause: PAUSE_SECONDS,
  overhead: TIMING_DEFAULTS.voiceLead + TIMING_DEFAULTS.tailPad,
};

// The JSON object in a reply (tolerates code fences or a stray sentence around it).
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("the reply contains no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

export function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "video";
}

// Fields the user already decided are not the director's to change.
export function pinFields(draft: Record<string, unknown>, brief: Brief, id: string): Record<string, unknown> {
  const plan: Record<string, unknown> = { ...draft, id, version: 1, format: brief.format, targetDuration: brief.durationSec, language: brief.language ?? "en" };
  if (brief.mood) plan.mood = brief.mood;
  if (brief.brand) plan.brand = brief.brand;
  // images come from the engine (website screenshots), never from the director
  const assets = brief.research ? researchAssets(brief.research) : {};
  if (Object.keys(assets).length) plan.assets = assets;
  else delete plan.assets;
  if (plan.music && typeof plan.music === "object") plan.music = { ...(plan.music as object), mode: "library" };
  return plan;
}

// Checks the validator can't do on its own: our voice list and (when the director chose them) Google Fonts.
async function extraChecks(plan: ScenePlan, brandFixed: boolean): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const fitting = voicesFor(plan.language);
  if (!fitting.some((v) => v.id === plan.voice.voiceId)) {
    const known = VOICES.some((v) => v.id === plan.voice.voiceId);
    issues.push({
      path: "voice.voiceId",
      message: `"${plan.voice.voiceId}" ${known ? `does not speak ${plan.language === "en" ? "English" : "Hindi"}` : "is not an available voice"}; use one of ${fitting.map((v) => v.id).join(", ")}`,
    });
  }
  if (!brandFixed) {
    for (const role of ["heading", "body"] as const) {
      const family = plan.brand.font[role];
      if (!(await isGoogleFont(family))) issues.push({ path: `brand.font.${role}`, message: `"${family}" is not a Google Fonts family; pick one that is (e.g. Inter, Space Grotesk, Poppins, DM Sans, Playfair Display)` });
    }
  }
  return issues;
}

export type PlanCheck = { ok: true; plan: ScenePlan } | { ok: false; errors: ValidationIssue[] };

// Everything a director-written plan must pass: the schema and plan rules, speech pacing, our voice list,
// and Google Fonts (skipped when the brand came from research or the user). Shared by the API director
// and the MCP connector.
export async function checkPlan(input: unknown, o: { sfxIds: string[]; brandFixed: boolean }): Promise<PlanCheck> {
  const r = validatePlan(input, { templates: templateRules(), sfxIds: o.sfxIds, speech: SPEECH });
  if (!r.ok) return r;
  const extra = await extraChecks(r.plan, o.brandFixed);
  return extra.length ? { ok: false, errors: extra } : r;
}

// The fix loop shared by new plans and chat edits: ask, parse, check, and send the exact problems back
// (with the previous answer) until the answer passes or the attempts run out.
async function converge<T>(
  o: DirectorOptions,
  first: string,
  fix: (previous: string, errors: string) => string,
  accept: (json: Record<string, unknown>) => Promise<{ ok: true; value: T } | { ok: false; errors: ValidationIssue[]; previous: string }>,
  what: string,
): Promise<{ value: T; attempts: Attempt[] }> {
  const system = systemPrompt(o.sounds, o.musicMoods, SPEECH.overhead);
  const attempts: Attempt[] = [];
  const maxAttempts = o.maxAttempts ?? 3;
  let previous: string | null = null;
  let errors: ValidationIssue[] = [];

  for (let n = 1; n <= maxAttempts; n++) {
    const t = Date.now();
    const user = previous === null ? first : fix(previous, formatIssues(errors));
    const { text, ...response } = await o.llm({ system, user });

    let json: Record<string, unknown> | null = null;
    try {
      const parsed = extractJson(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("the JSON is not an object");
      json = parsed as Record<string, unknown>;
    } catch (e) {
      errors = [{ path: "(reply)", message: `not a valid JSON object: ${(e as Error).message}. Return only the JSON object.` }];
      previous = text.slice(0, 20000);
    }
    if (json) {
      const r = await accept(json);
      if (r.ok) {
        const attempt = { n, response, raw: text, errors: [], ms: Date.now() - t };
        attempts.push(attempt);
        o.onAttempt?.(attempt);
        return { value: r.value, attempts };
      }
      errors = r.errors;
      previous = r.previous;
    }
    const attempt = { n, response, raw: text, errors, ms: Date.now() - t };
    attempts.push(attempt);
    o.onAttempt?.(attempt);
  }
  const err = new DirectorError(`the director could not ${what} in ${maxAttempts} attempts. Last problems:\n${formatIssues(errors)}`);
  (err as DirectorError & { attempts: Attempt[] }).attempts = attempts;
  throw err;
}

export async function writePlan(brief: Brief, o: DirectorOptions & { id?: string }): Promise<{ plan: ScenePlan; attempts: Attempt[] }> {
  let id: string | null = o.id ?? null;
  const sfxIds = o.sounds.map((s) => s.id);
  const { value, attempts } = await converge(
    o,
    briefMessage(brief),
    (previous, errors) => fixMessage(brief, previous, errors),
    async (draft) => {
      id ??= `${slug(typeof draft.title === "string" ? draft.title : brief.prompt)}-${Date.now().toString(36)}`;
      const r = await checkPlan(pinFields(draft, brief, id), { sfxIds, brandFixed: !!brief.brand });
      return r.ok ? { ok: true, value: r.plan } : { ok: false, errors: r.errors, previous: JSON.stringify(draft, null, 1) };
    },
    "write a valid plan",
  );
  return { plan: value, attempts };
}

// A chat edit. What the user can't change by chat stays pinned: the plan id and version, the format,
// the language and the logo. Returns the revised plan (same version number; the caller numbers it).
export async function revisePlan(req: EditRequest, o: DirectorOptions): Promise<{ plan: ScenePlan; summary: string; attempts: Attempt[] }> {
  const current = req.plan as Record<string, unknown> & { brand?: { logoUrl?: string } };
  const sfxIds = o.sounds.map((s) => s.id);
  const { value, attempts } = await converge(
    o,
    editMessage(req),
    (previous, errors) => editFixMessage(req, previous, errors),
    async (json) => {
      const draft = json.plan && typeof json.plan === "object" && !Array.isArray(json.plan) ? (json.plan as Record<string, unknown>) : null;
      if (!draft) return { ok: false, errors: [{ path: "plan", message: 'the answer needs a "plan" object with the complete revised plan' }], previous: JSON.stringify(json, null, 1) };
      const brand = draft.brand && typeof draft.brand === "object" ? { ...(draft.brand as object) } : draft.brand;
      if (brand && typeof brand === "object") {
        const logoUrl = current.brand?.logoUrl;
        if (logoUrl) (brand as { logoUrl?: string }).logoUrl = logoUrl;
        else delete (brand as { logoUrl?: string }).logoUrl;
      }
      const pinned = {
        ...draft,
        brand,
        id: current.id,
        version: current.version,
        format: current.format,
        language: current.language,
        assets: current.assets,
        music: draft.music && typeof draft.music === "object" ? { ...(draft.music as object), mode: "library" } : draft.music,
        scenes: Array.isArray(draft.scenes) ? draft.scenes.map((s) => (s && typeof s === "object" ? { ...s, start: undefined, duration: undefined } : s)) : draft.scenes,
      };
      const r = await checkPlan(pinned, { sfxIds, brandFixed: false });
      const summary = typeof json.summary === "string" && json.summary.trim() ? json.summary.trim().slice(0, 300) : "Updated the plan.";
      return r.ok ? { ok: true, value: { plan: r.plan, summary } } : { ok: false, errors: r.errors, previous: JSON.stringify({ summary, plan: draft }, null, 1) };
    },
    "make this change",
  );
  return { ...value, attempts };
}
