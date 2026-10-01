import { normalizeWord, type ScenePlan } from "@frameflow/scene-schema";
import type { BeatGrid, SceneTiming, SceneVoice, TemplateTiming, TimedWord, TimingResult } from "./types.js";

export const TIMING_DEFAULTS = {
  voiceLead: 0.2, // the voice starts this long after its scene's cut, so the visual lands first
  tailPad: 0.35, // natural pause after the last spoken word before the next cut
  minTail: 0.12, // a cut never comes sooner than this after the voice ends (motion-video-skill's CUT_AFTER)
  maxShift: 0.25, // how far a cut may move to land on the nearest beat
  maxForward: 0.65, // when the nearest beats are on the blocked side, how long a cut may wait for the next beat
  endHold: 1.0, // the last scene holds this long after its voice, so the ending can breathe before the fade
  itemHold: 1.0, // a list scene stays on screen this long after its last item appears (at least 75% of it after beat snapping)
  fps: 30,
};
export type TimingOptions = typeof TIMING_DEFAULTS;

const round = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// The beat closest to `natural`, at most `maxShift` away and inside [earliest, latest]; null if none.
export function snapToBeat(natural: number, beats: number[], limits: { earliest: number; latest: number; maxShift: number }): number | null {
  let best: number | null = null;
  for (const b of beats) {
    if (Math.abs(b - natural) > limits.maxShift + 1e-9) continue;
    if (b < limits.earliest - 1e-9 || b > limits.latest + 1e-9) continue;
    if (best === null || Math.abs(b - natural) < Math.abs(best - natural)) best = b;
  }
  return best;
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "your", "you", "our", "all", "any", "one", "new", "get", "its", "into", "from", "that", "this"]);

// The word we expect the narrator to say when a list item should appear: the first meaningful word of its title.
export function anchorWord(item: unknown): string | null {
  let text = "";
  if (typeof item === "string") text = item;
  else if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const v = o.title ?? o.label ?? o.text ?? Object.values(o).find((x) => typeof x === "string");
    if (typeof v === "string") text = v;
  }
  const words = text.split(/[\s\-/]+/).map(normalizeWord).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return words[0] ?? null;
}

const sameStem = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

// When each list item appears: on its anchor word if the narrator says it, otherwise spread evenly over `range`.
export function itemRevealTimes(items: unknown[], words: TimedWord[], range: [number, number], minGap = 0.18): number[] {
  const n = items.length;
  if (!n) return [];
  const step = Math.max(range[1] - range[0], 0) / n;
  const times: number[] = [];
  let after = -Infinity;
  const anchored = items.map((item) => {
    const key = anchorWord(item);
    const hit = key ? words.find((w) => w.s > after && sameStem(w.w, key)) : undefined;
    if (!hit) return null;
    after = hit.s;
    return Math.max(range[0], hit.s - 0.08); // a hair before the word, so the eye and ear agree
  });
  for (let k = 0; k < n; k++) {
    let t = anchored[k] ?? range[0] + k * step;
    const nextAnchor = anchored.slice(k + 1).find((x) => x !== null);
    if (anchored[k] === null && nextAnchor != null) t = Math.min(t, nextAnchor - minGap);
    if (k > 0) t = Math.max(t, times[k - 1] + minGap);
    times.push(round(t));
  }
  return times;
}

function timedWords(voice: SceneVoice, voiceStart: number): TimedWord[] {
  return voice.words.map((w) => ({ w: normalizeWord(w.word), text: w.word, s: round(voiceStart + w.start), e: round(voiceStart + w.end) }));
}

// Final scene timing: duration from the voice (+ padding, clamped to the template limits),
// then each cut snapped to the nearest beat within maxShift, never cutting into the voice.
export function computeTiming(
  plan: ScenePlan,
  voices: Record<string, SceneVoice | undefined>,
  grid: BeatGrid | null,
  templates: Record<string, TemplateTiming>,
  options: Partial<TimingOptions> = {},
): TimingResult {
  const o = { ...TIMING_DEFAULTS, ...options };
  const warnings: string[] = [];
  const scenes: SceneTiming[] = [];
  let start = 0;

  plan.scenes.forEach((scene, i) => {
    const t = templates[scene.template];
    if (!t) throw new Error(`timing: unknown template "${scene.template}"`);
    const hasVoice = scene.voiceover.trim().length > 0;
    const voice = hasVoice ? voices[scene.id] : undefined;
    if (hasVoice && !voice) throw new Error(`timing: no voice audio for scene "${scene.id}"`);

    const voiceStart = voice ? start + o.voiceLead : null;
    const voiceEnd = voice ? voiceStart! + voice.duration : null;
    const isLast = i === plan.scenes.length - 1;

    // list items appear on their spoken words (or spread out when nothing is spoken)
    const words = voice ? timedWords(voice, voiceStart!) : [];
    const list = t.listField && Array.isArray(scene.content[t.listField]) ? (scene.content[t.listField] as unknown[]) : [];
    const estLength = clamp(scene.estDuration, t.minDuration, t.maxDuration);
    const itemRange: [number, number] = voice
      ? [voiceStart!, Math.max(voiceStart!, voiceEnd! - 0.3)]
      : [start + 0.3, start + Math.min(estLength * 0.6, 0.3 + 0.35 * list.length)];
    const items = itemRevealTimes(list, words, itemRange);
    const lastItem = items.length ? items[items.length - 1] : null;

    // natural length: the voice plus padding, and long enough to see the last list item
    let natural = voice ? voiceEnd! - start + o.tailPad + (isLast ? o.endHold : 0) : scene.estDuration;
    if (lastItem !== null) natural = Math.max(natural, lastItem + o.itemHold - start);
    let length = clamp(natural, t.minDuration, t.maxDuration);
    const minEnd = Math.max(voiceEnd !== null ? voiceEnd + o.minTail : start, lastItem !== null ? lastItem + o.itemHold * 0.75 : start);
    if (start + length < minEnd) {
      const what = [voice ? `the voice (${voice.duration.toFixed(2)}s)` : "", lastItem !== null ? "time to see the last list item" : ""].filter(Boolean).join(" plus ");
      warnings.push(`scene "${scene.id}": ${what} does not fit ${scene.template}'s ${t.maxDuration}s limit; the scene was stretched to fit. Shorten the voiceover.`);
      length = minEnd - start;
    }
    let end = start + length;

    let cutOut: SceneTiming["cutOut"] = null;
    if (!isLast) {
      const naturalCut = end;
      let beat: number | null = null;
      if (grid) {
        const earliest = Math.max(minEnd, start + t.minDuration);
        const latest = Math.max(start + t.maxDuration, earliest);
        beat = snapToBeat(naturalCut, grid.beats, { earliest, latest, maxShift: o.maxShift });
        if (beat === null) {
          // the nearby beats were on the blocked side (the voice still speaking, or below the template's
          // minimum): wait for the next beat instead, up to one beat period later
          const from = Math.max(earliest, naturalCut);
          const until = Math.min(naturalCut + o.maxForward, Math.max(latest, earliest + o.maxForward));
          beat = grid.beats.find((b) => b >= from - 1e-9 && b <= until + 1e-9) ?? null;
        }
        if (beat === null) warnings.push(`scene "${scene.id}": no usable beat near the cut at ${naturalCut.toFixed(2)}s; the cut stays off the beat.`);
        else end = beat;
      }
      cutOut = { natural: round(naturalCut), beat: beat === null ? null : round(beat) };
    }

    scenes.push({
      id: scene.id,
      template: scene.template,
      start: round(start),
      duration: round(end - start),
      end: round(end),
      voiceStart: voiceStart === null ? null : round(voiceStart),
      voiceEnd: voiceEnd === null ? null : round(voiceEnd),
      words,
      items,
      accent: t.accentAt !== undefined ? round(start + Math.min(t.accentAt, end - start)) : null,
      cutOut,
    });
    start = end;
  });

  const duration = round(start);
  return {
    duration,
    fps: o.fps,
    bpm: grid?.bpm ?? null,
    beats: grid ? grid.beats.filter((b) => b >= 0 && b <= duration).map(round) : [],
    downbeats: grid ? grid.downbeats.filter((b) => b >= 0 && b <= duration).map(round) : [],
    scenes,
    warnings,
  };
}

// Write the final start/duration of each scene back into the plan.
export function applyTiming(plan: ScenePlan, timing: TimingResult): ScenePlan {
  const byId = new Map(timing.scenes.map((s) => [s.id, s]));
  return {
    ...plan,
    scenes: plan.scenes.map((scene) => {
      const t = byId.get(scene.id);
      return t ? { ...scene, start: t.start, duration: t.duration } : scene;
    }),
  };
}
