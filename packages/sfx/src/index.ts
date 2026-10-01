import { normalizeWord, type ScenePlan } from "@frameflow/scene-schema";
import type { SceneTiming, TimingResult } from "@frameflow/timing";

// One entry of assets/sfx/sfx.json.
export interface SfxSound {
  id: string;
  file: string;
  duration: number;
  hitOffset: number; // seconds from the file start to the sound's peak; the peak is what lands on the event
  gain: number; // default cue volume
  description?: string;
}

// The parts of a template's meta that SFX placement needs.
export interface TemplateSfx {
  listField?: string;
  accentSound?: string; // played on the template's accent (e.g. logo_reveal -> impact)
}

// "accent" and "before_start" are internal anchors used by the default rules.
export type Anchor = "start" | "end" | "each_item" | "on_word" | "accent" | "before_start";

export interface PlacedCue {
  sceneId: string;
  sound: string;
  anchor: Anchor;
  event: number; // when the sound's peak lands (video seconds)
  t: number; // when the file starts: event - hitOffset (can be < 0; the mixer trims the head)
  vol: number;
  source: "default" | "director";
}

interface CueRule {
  at: Anchor;
  sound: string;
  word?: string;
  source: PlacedCue["source"];
}

export const DEFAULT_SOUNDS = { cut: "whoosh", item: "pop", beforeLast: "riser" };
const DEDUPE_WINDOW = 0.08;
const round = (x: number) => Math.round(x * 1000) / 1000;

// Default rules: every cut gets a whoosh, each list item a pop, a template's accent its accent
// sound (logo_reveal -> impact), and a riser leads into the last scene.
export function defaultRules(plan: ScenePlan, index: number, templates: Record<string, TemplateSfx>): CueRule[] {
  const scene = plan.scenes[index];
  const meta = templates[scene.template] ?? {};
  const rules: CueRule[] = [];
  if (index > 0) rules.push({ at: "start", sound: DEFAULT_SOUNDS.cut, source: "default" });
  if (meta.listField && Array.isArray(scene.content[meta.listField])) rules.push({ at: "each_item", sound: DEFAULT_SOUNDS.item, source: "default" });
  if (meta.accentSound) rules.push({ at: "accent", sound: meta.accentSound, source: "default" });
  if (index > 0 && index === plan.scenes.length - 1) rules.push({ at: "before_start", sound: DEFAULT_SOUNDS.beforeLast, source: "default" });
  return rules;
}

function eventTimes(rule: CueRule, st: SceneTiming): number[] | string {
  switch (rule.at) {
    case "start":
    case "before_start":
      return [st.start];
    case "end":
      return [st.end];
    case "each_item":
      return st.items.length ? st.items : "this scene has no list items";
    case "accent":
      return st.accent === null ? "this template has no accent" : [st.accent];
    case "on_word": {
      const w = normalizeWord(rule.word ?? "");
      const hit = st.words.find((x) => x.w === w);
      return hit ? [hit.s] : `the word "${rule.word}" is not spoken in this scene`;
    }
  }
}

// Turn the plan's events into timed SFX cues. A director cue replaces the default with the same
// anchor in that scene (e.g. {at:"start", sound:"swoosh"} swaps the cut's whoosh); others are added.
export function placeSfx(
  plan: ScenePlan,
  timing: TimingResult,
  library: SfxSound[],
  templates: Record<string, TemplateSfx>,
): { cues: PlacedCue[]; warnings: string[] } {
  const sounds = new Map(library.map((s) => [s.id, s]));
  const warnings: string[] = [];
  const cues: PlacedCue[] = [];

  plan.scenes.forEach((scene, i) => {
    const st = timing.scenes.find((s) => s.id === scene.id);
    if (!st) throw new Error(`sfx: no timing for scene "${scene.id}"`);
    const director: CueRule[] = scene.sfx.map((c) => ({ at: c.at, sound: c.sound, word: c.word, source: "director" }));
    const overridden = new Set(director.map((c) => c.at));
    const rules = [...defaultRules(plan, i, templates).filter((r) => !overridden.has(r.at)), ...director];

    for (const rule of rules) {
      const sound = sounds.get(rule.sound);
      if (!sound) {
        warnings.push(`scene "${scene.id}": sound "${rule.sound}" is not in the library; cue skipped`);
        continue;
      }
      const times = eventTimes(rule, st);
      if (typeof times === "string") {
        warnings.push(`scene "${scene.id}": ${rule.at} cue "${rule.sound}" skipped: ${times}`);
        continue;
      }
      for (const event of times) {
        cues.push({ sceneId: scene.id, sound: sound.id, anchor: rule.at, event: round(event), t: round(event - sound.hitOffset), vol: sound.gain, source: rule.source });
      }
    }
  });

  // The same sound twice at (almost) the same moment just sounds louder; keep the first.
  cues.sort((a, b) => a.event - b.event);
  const kept = cues.filter((c, i) => !cues.slice(0, i).some((p) => p.sound === c.sound && Math.abs(p.event - c.event) < DEDUPE_WINDOW));
  return { cues: kept.sort((a, b) => a.t - b.t), warnings };
}
