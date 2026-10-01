import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { safeFetch } from "@frameflow/director";
import { BALANCE_TARGET, decodeMono, ffmpeg, mix, MIX_SETTINGS, type Loudness, type MixBalance } from "@frameflow/mixer";
import { socialEncode, verifyVideo, type Check, type Quality, type Renderer } from "@frameflow/renderer";
import { FORMAT_SIZE, formatIssues, validatePlan, type Format, type ScenePlan } from "@frameflow/scene-schema";
import { placeSfx, type PlacedCue } from "@frameflow/sfx";
import { templateRules, templates } from "@frameflow/templates";
import { applyTiming, buildCaptions, computeTiming, toSrt, toVtt, type BeatGrid, type CaptionChunk, type SceneVoice, type TimingResult } from "@frameflow/timing";
import type { AudioClient, BeatsResult } from "./audio-client.js";
import { loadMusicLibrary, loadSfxLibrary, pickTrack } from "./library.js";
import type { Storage } from "./storage.js";

export const STEPS = [
  { id: "brand", label: "Reading the website" },
  { id: "director", label: "Writing the script" },
  { id: "validate", label: "Checking the plan" },
  { id: "voiceover", label: "Making voice" },
  { id: "alignment", label: "Timing the words" },
  { id: "music", label: "Picking music" },
  { id: "timing", label: "Cutting on the beat" },
  { id: "sfx", label: "Placing sound effects" },
  { id: "mix", label: "Mixing audio" },
  { id: "captions", label: "Writing captions" },
  { id: "render", label: "Rendering" },
  { id: "finish", label: "Final checks" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];
export interface StepEvent {
  step: StepId;
  status: "start" | "done" | "info" | "warn";
  message?: string;
  ms?: number;
}

// The render pipeline, one stage per step. Each stage reads what earlier stages wrote into the version's
// folder and writes its own output there, so a stage can run as its own job (and be retried alone).
export const RENDER_STAGES = ["validate", "voiceover", "alignment", "music", "timing", "sfx", "mix", "captions", "render", "finish"] as const satisfies readonly StepId[];
export type RenderStage = (typeof RENDER_STAGES)[number];

export interface RenderOptions {
  quality?: Quality;
  burnCaptions?: boolean;
  social?: boolean;
  preview?: boolean; // single-scene template preview: skip the whole-video rules
  formats?: Format[]; // more formats rendered from the same plan and audio (the plan's own format is always rendered)
}

export interface StageContext {
  storage: Storage;
  audio: AudioClient;
  renderer: Renderer;
  assetsDir: string;
  outKey: string; // storage prefix of this version, e.g. projects/<id>/v2
  planDir: string; // relative logo paths are resolved against this
  options: RenderOptions;
  onEvent?: (e: StepEvent) => void;
}

export interface MakeVideoOptions extends RenderOptions {
  plan: unknown;
  planDir: string;
  storage: Storage;
  audio: AudioClient;
  renderer: Renderer;
  assetsDir: string;
  outKey?: string; // storage prefix for outputs; default projects/<plan id>/v<version>
  onEvent?: (e: StepEvent) => void;
}

export interface QaReport {
  duration: number;
  music: { track: string; bpm: number; offset: number };
  cuts: { into: string; at: number; onBeat: boolean; shiftMs: number | null }[];
  loudness: Loudness | null;
  balance: MixBalance | null;
  checks: Check[];
  warnings: string[];
  reused: string[]; // what an edit did not have to redo, e.g. "voice for 4 of 5 scenes"
  videos: Partial<Record<Format, string>>; // file name per rendered format
}

export interface MakeVideoResult {
  outDir: string;
  video: string;
  social: string | null;
  videos: Partial<Record<Format, string>>; // absolute paths
  plan: ScenePlan;
  timing: TimingResult;
  qa: QaReport;
}

interface MusicChoice {
  trackId: string;
  file: string; // inside assets/music
  title: string;
  license: string;
  attribution: string;
  offset: number; // seconds into the track at video t = 0
  grid: BeatGrid;
}

const hash = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 16);
const round = (x: number) => Math.round(x * 1000) / 1000;

export class PlanError extends Error {}

export async function step<T>(id: StepId, onEvent: MakeVideoOptions["onEvent"], fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  onEvent?.({ step: id, status: "start" });
  const result = await fn();
  onEvent?.({ step: id, status: "done", ms: Date.now() - t });
  return result;
}

// File name of a format's video: the plan's own format is video.mp4, others video-9x16.mp4 etc.
export function videoFileName(format: Format, main: Format): string {
  return format === main ? "video.mp4" : `video-${format.replace(":", "x")}.mp4`;
}

// A logo or image reference: an http(s) URL (downloaded once, SSRF-guarded), an absolute path, or a
// path relative to the plan (for the web app: a storage key).
async function resolveFile(ref: string | undefined, planDir: string, storage: Storage, what: string): Promise<string | null> {
  if (!ref) return null;
  if (/^https?:\/\//.test(ref)) {
    const key = `cache/logos/${hash(ref)}${extname(new URL(ref).pathname) || ".png"}`;
    if (!storage.exists(key)) {
      const res = await safeFetch(ref);
      if (!res.ok) throw new Error(`could not download the ${what} (${ref}): HTTP ${res.status}`);
      await storage.write(key, new Uint8Array(await res.arrayBuffer()));
    }
    return storage.path(key);
  }
  const p = isAbsolute(ref) ? ref : resolve(planDir, ref);
  if (!existsSync(p)) throw new Error(`${what} file not found: ${p}`);
  return p;
}

// Local files for the images the scenes show (by plan.assets name).
async function resolveImages(plan: ScenePlan, planDir: string, storage: Storage): Promise<Record<string, string>> {
  const used = new Set(plan.scenes.map((s) => (s.content as { image?: unknown }).image).filter((x): x is string => typeof x === "string"));
  const files: Record<string, string> = {};
  for (const name of used) {
    const asset = plan.assets?.[name];
    if (asset) files[name] = (await resolveFile(asset.file, planDir, storage, `image "${name}"`))!;
  }
  return files;
}

async function loadLibraries(assetsDir: string) {
  const [tracks, sfx] = await Promise.all([loadMusicLibrary(assetsDir), loadSfxLibrary(assetsDir)]);
  return { tracks, sfx };
}

// The engine's own check of a plan (the director's checkPlan adds pacing, voices and fonts on top).
export async function checkRenderPlan(input: unknown, assetsDir: string, preview = false): Promise<ScenePlan> {
  const { sfx } = await loadLibraries(assetsDir);
  const r = validatePlan(input, { templates: templateRules(), sfxIds: sfx.map((s) => s.id), planRules: !preview });
  if (!r.ok) throw new PlanError(`the scene plan is not valid:\n${formatIssues(r.errors)}`);
  return r.plan;
}

// Runs one stage. `input.plan` is only used by "validate" (every other stage reads plan.json).
export async function runStage(stage: RenderStage, c: StageContext, input?: { plan: unknown }): Promise<void> {
  await step(stage, c.onEvent, () => STAGES[stage](c, input));
}

type StageFn = (c: StageContext, input?: { plan: unknown }) => Promise<void>;

const out = (c: StageContext, name: string) => `${c.outKey}/${name}`;
const info = (c: StageContext, step: StepId, message: string) => c.onEvent?.({ step, status: "info", message });
const readPlan = (c: StageContext) => c.storage.readJson<ScenePlan>(out(c, "plan.json"));
const spokenScenes = (plan: ScenePlan) => plan.scenes.filter((s) => s.voiceover.trim());
const ttsKey = (plan: ScenePlan, text: string) => `cache/tts/${hash([plan.voice.engine, plan.voice.voiceId, plan.voice.speed, text])}.wav`;

// Warnings are kept per stage (a retried stage replaces its own), and collected by "finish".
async function saveWarnings(c: StageContext, stage: RenderStage, list: string[]) {
  const key = out(c, "warnings.json");
  const all = c.storage.exists(key) ? await c.storage.readJson<Record<string, string[]>>(key) : {};
  all[stage] = list;
  await c.storage.writeJson(key, all);
  list.forEach((message) => c.onEvent?.({ step: stage, status: "warn", message }));
}
async function saveReused(c: StageContext, stage: RenderStage, note: string | null) {
  const key = out(c, "reused.json");
  const all = c.storage.exists(key) ? await c.storage.readJson<Record<string, string>>(key) : {};
  if (note) all[stage] = note;
  else delete all[stage];
  await c.storage.writeJson(key, all);
  if (note) info(c, stage, `reused ${note}`);
}

const STAGES: Record<RenderStage, StageFn> = {
  async validate(c, input) {
    if (!input) throw new Error("the validate stage needs the plan");
    const plan = await checkRenderPlan(input.plan, c.assetsDir, c.options.preview);
    await c.storage.writeJson(out(c, "plan.json"), plan);
  },

  // one file per scene, cached by (engine, voice, speed, text): unchanged voiceovers are reused
  async voiceover(c) {
    const plan = await readPlan(c);
    const spoken = spokenScenes(plan);
    const keys: Record<string, string> = {};
    let made = 0;
    for (const [i, scene] of spoken.entries()) {
      const key = ttsKey(plan, scene.voiceover);
      keys[scene.id] = key;
      if (c.storage.exists(key)) continue;
      info(c, "voiceover", `scene ${i + 1}/${spoken.length}`);
      await c.storage.write(key, await c.audio.tts(scene.voiceover, plan.voice.voiceId, plan.voice.speed, plan.voice.engine));
      made++;
    }
    await c.storage.writeJson(out(c, "voices.json"), keys);
    await saveReused(c, "voiceover", spoken.length && made < spoken.length ? `voice for ${spoken.length - made} of ${spoken.length} scenes` : null);
  },

  // word timestamps per scene, cached by (voice file, text, language)
  async alignment(c) {
    const plan = await readPlan(c);
    const keys = await c.storage.readJson<Record<string, string>>(out(c, "voices.json"));
    const spoken = spokenScenes(plan);
    const voices: Record<string, SceneVoice> = {};
    let made = 0;
    for (const [i, scene] of spoken.entries()) {
      const key = `cache/align/${hash([keys[scene.id], scene.voiceover, plan.language])}.json`;
      if (!c.storage.exists(key)) {
        info(c, "alignment", `scene ${i + 1}/${spoken.length}`);
        await c.storage.writeJson(key, await c.audio.align(await c.storage.read(keys[scene.id]), scene.voiceover, plan.language === "en" ? "en" : "hi"));
        made++;
      }
      voices[scene.id] = await c.storage.readJson<SceneVoice>(key);
    }
    await c.storage.writeJson(out(c, "alignment.json"), voices);
    await saveReused(c, "alignment", spoken.length && made < spoken.length ? `word timings for ${spoken.length - made} of ${spoken.length} scenes` : null);
  },

  // pick from the library, then the beat grid (cached per track file)
  async music(c) {
    const plan = await readPlan(c);
    if (plan.music.mode !== "library") throw new PlanError('music mode "generate" (ACE-Step) needs a GPU music service that is not set up; use "library"');
    const { tracks } = await loadLibraries(c.assetsDir);
    const estTotal = plan.scenes.reduce((s, x) => s + x.estDuration, 0);
    const track = pickTrack(tracks, { mood: plan.music.mood, planMood: plan.mood, bpm: plan.music.bpm, trackId: plan.music.trackId, minDuration: estTotal + 10 });
    const key = `cache/beats/${track.id}-${hash([track.file, track.duration])}.json`;
    if (!c.storage.exists(key)) await c.storage.writeJson(key, await c.audio.beats(join(c.assetsDir, "music", track.file), track.bpm));
    const beats = await c.storage.readJson<BeatsResult>(key);
    // start the music on its first downbeat, so video t = 0 is a downbeat
    const offset = beats.downbeats[0] ?? beats.beats[0] ?? 0;
    const shift = (xs: number[]) => xs.map((b) => round(b - offset)).filter((b) => b >= 0);
    const choice: MusicChoice = {
      trackId: track.id,
      file: track.file,
      title: track.title,
      license: track.license,
      attribution: track.attribution,
      offset: round(offset),
      grid: { bpm: beats.bpm, beats: shift(beats.beats), downbeats: shift(beats.downbeats) },
    };
    await c.storage.writeJson(out(c, "music.json"), choice);
    info(c, "music", `${track.title} (${track.bpm.toFixed(0)} BPM, ${track.license})`);
  },

  // scene durations from the voice, cuts snapped to the beat
  async timing(c) {
    const plan = await readPlan(c);
    const voices = await c.storage.readJson<Record<string, SceneVoice>>(out(c, "alignment.json"));
    const music = await c.storage.readJson<MusicChoice>(out(c, "music.json"));
    const metas = Object.values(templates).map((t) => t.meta);
    const timingMeta = Object.fromEntries(metas.map((m) => [m.name, { minDuration: m.minDuration, maxDuration: m.maxDuration, listField: m.listField, accentAt: m.accentAt }]));
    const timing = computeTiming(plan, voices, music.grid, timingMeta);
    await c.storage.writeJson(out(c, "timing.json"), timing);
    await c.storage.writeJson(out(c, "plan.timed.json"), applyTiming(plan, timing));
    await saveWarnings(c, "timing", timing.warnings);
  },

  async sfx(c) {
    const timed = await c.storage.readJson<ScenePlan>(out(c, "plan.timed.json"));
    const timing = await c.storage.readJson<TimingResult>(out(c, "timing.json"));
    const { sfx } = await loadLibraries(c.assetsDir);
    const sfxMeta = Object.fromEntries(Object.values(templates).map((t) => [t.meta.name, { listField: t.meta.listField, accentSound: t.meta.accentSound }]));
    const { cues, warnings } = placeSfx(timed, timing, sfx, sfxMeta);
    await c.storage.writeJson(out(c, "sfx-cues.json"), cues);
    await saveWarnings(c, "sfx", warnings);
  },

  // the mix is cached by everything that goes into it: an edit that changes only on-screen text reuses it
  async mix(c) {
    const timing = await c.storage.readJson<TimingResult>(out(c, "timing.json"));
    const voiceKeys = await c.storage.readJson<Record<string, string>>(out(c, "voices.json"));
    const music = await c.storage.readJson<MusicChoice>(out(c, "music.json"));
    const cues = await c.storage.readJson<PlacedCue[]>(out(c, "sfx-cues.json"));
    const { sfx } = await loadLibraries(c.assetsDir);
    const sfxFile = new Map(sfx.map((s) => [s.id, join(c.assetsDir, "sfx", s.file)]));
    const speech = timing.scenes.filter((s) => s.words.length).map((s): [number, number] => [s.words[0].s, s.words[s.words.length - 1].e]);
    const input = {
      duration: timing.duration,
      music: { file: join(c.assetsDir, "music", music.file), offset: music.offset },
      voices: timing.scenes.filter((s) => s.voiceStart !== null).map((s) => ({ file: c.storage.path(voiceKeys[s.id]), at: s.voiceStart! })),
      sfx: cues.map((q) => ({ file: sfxFile.get(q.sound)!, t: q.t, vol: q.vol })),
      balance: { speech },
    };
    const cacheKey = `cache/mix/${hash([input, MIX_SETTINGS])}`;
    const mixFile = c.storage.path(out(c, "mix.m4a"));
    if (c.storage.exists(`${cacheKey}.m4a`)) {
      await copyFile(c.storage.path(`${cacheKey}.m4a`), mixFile);
      await c.storage.writeJson(out(c, "mix.json"), await c.storage.readJson(`${cacheKey}.json`));
      await saveReused(c, "mix", "the audio mix (sound unchanged)");
      return;
    }
    const result = await mix({ ...input, workDir: c.storage.path(out(c, "work/mix")), outFile: mixFile });
    const summary = { balance: result.balance, musicGainDb: result.musicGainDb, premixLufs: result.premixLufs };
    await c.storage.writeJson(out(c, "mix.json"), summary);
    await mkdir(dirname(c.storage.path(`${cacheKey}.m4a`)), { recursive: true });
    await copyFile(mixFile, c.storage.path(`${cacheKey}.m4a`));
    await c.storage.writeJson(`${cacheKey}.json`, summary);
    await saveReused(c, "mix", null);
  },

  async captions(c) {
    const timing = await c.storage.readJson<TimingResult>(out(c, "timing.json"));
    const captions = buildCaptions(timing);
    await c.storage.writeJson(out(c, "captions.json"), captions);
    await c.storage.write(out(c, "captions.srt"), toSrt(captions));
    await c.storage.write(out(c, "captions.vtt"), toVtt(captions));
  },

  // the audio models are released first: headless Chrome needs the memory on 8 GB machines
  async render(c) {
    await c.audio.unload();
    const timed = await c.storage.readJson<ScenePlan>(out(c, "plan.timed.json"));
    const timing = await c.storage.readJson<TimingResult>(out(c, "timing.json"));
    const captions = await c.storage.readJson<CaptionChunk[]>(out(c, "captions.json"));
    const logoFile = await resolveFile(timed.brand.logoUrl, c.planDir, c.storage, "logo");
    const images = await resolveImages(timed, c.planDir, c.storage);
    const formats = [timed.format, ...(c.options.formats ?? []).filter((f) => f !== timed.format)];
    const warnings: string[] = [];
    for (const format of formats) {
      if (formats.length > 1) info(c, "render", `${format} (${formats.indexOf(format) + 1} of ${formats.length})`);
      const r = await c.renderer.render({
        plan: { ...timed, format },
        timing,
        captions,
        burnCaptions: !!c.options.burnCaptions,
        mixFile: c.storage.path(out(c, "mix.m4a")),
        logoFile,
        images,
        workDir: c.storage.path(out(c, format === timed.format ? "work" : `work/${format.replace(":", "x")}`)),
        output: c.storage.path(out(c, videoFileName(format, timed.format))),
        quality: c.options.quality ?? "high",
        onProgress: (m) => info(c, "render", formats.length > 1 ? `${format}: ${m}` : m),
      });
      warnings.push(...r.warnings.filter((w) => !warnings.includes(w)));
    }
    await saveWarnings(c, "render", warnings);
  },

  // social version, checks, credits, a poster frame and the waveform for the editor
  async finish(c) {
    const timed = await c.storage.readJson<ScenePlan>(out(c, "plan.timed.json"));
    const timing = await c.storage.readJson<TimingResult>(out(c, "timing.json"));
    const music = await c.storage.readJson<MusicChoice>(out(c, "music.json"));
    const { balance } = await c.storage.readJson<{ balance: MixBalance | null }>(out(c, "mix.json"));
    const video = c.storage.path(out(c, "video.mp4"));
    if (c.options.social !== false) await socialEncode(video, c.storage.path(out(c, "video-social.mp4")));

    const videos: Partial<Record<Format, string>> = {};
    const checks: Check[] = [];
    for (const format of [timed.format, ...(c.options.formats ?? []).filter((f) => f !== timed.format)]) {
      const name = videoFileName(format, timed.format);
      if (!c.storage.exists(out(c, name))) continue;
      videos[format] = name;
      const size = FORMAT_SIZE[format];
      const found = await verifyVideo(c.storage.path(out(c, name)), { width: size.width, height: size.height, fps: timing.fps, duration: timing.duration });
      // the plan's own format keeps the plain check names; other formats are labeled
      checks.push(...(format === timed.format ? found : found.filter((x) => x.name !== "loudness").map((x) => ({ ...x, name: `${x.name} (${format})` }))));
    }
    if (balance) {
      checks.push({
        name: "mix balance",
        ok: balance.musicBelowVoice >= BALANCE_TARGET.min && balance.musicBelowVoice <= BALANCE_TARGET.max,
        detail: `music ${balance.musicBelowVoice} dB under the voice while speaking (want ${BALANCE_TARGET.min}-${BALANCE_TARGET.max}); gaps ${balance.musicInGaps} dB vs voice ${balance.voice} dB`,
      });
    }
    const snapped = timing.scenes.filter((s) => s.cutOut);
    checks.push({
      name: "cuts on the beat",
      ok: snapped.every((s) => s.cutOut!.beat !== null),
      detail: `${snapped.filter((s) => s.cutOut!.beat !== null).length}/${snapped.length} cuts on a beat`,
    });
    await writeFile(
      c.storage.path(out(c, "credits.txt")),
      `Music: ${music.attribution.replace(/\n/g, "\n  ")}\nSound effects: Kenney (kenney.nl), CC0; synthesized effects by Frameflow, CC0\nIcons: Tabler Icons (tabler.io), MIT\n`,
    );
    await writePoster(video, c.storage.path(out(c, "poster.jpg")), timing);
    await c.storage.writeJson(out(c, "waveform.json"), await waveform(c.storage.path(out(c, "mix.m4a")), timing.duration));

    const warnings = c.storage.exists(out(c, "warnings.json")) ? Object.values(await c.storage.readJson<Record<string, string[]>>(out(c, "warnings.json"))).flat() : [];
    const reused = c.storage.exists(out(c, "reused.json")) ? Object.values(await c.storage.readJson<Record<string, string>>(out(c, "reused.json"))) : [];
    const loudness = checks.find((x) => x.name === "loudness");
    const qa: QaReport = {
      duration: timing.duration,
      music: { track: music.trackId, bpm: music.grid.bpm, offset: music.offset },
      cuts: timing.scenes.slice(1).map((s, i) => {
        const prev = timing.scenes[i].cutOut!;
        return { into: s.id, at: s.start, onBeat: prev.beat !== null, shiftMs: prev.beat === null ? null : Math.round((prev.beat - prev.natural) * 1000) };
      }),
      loudness: loudness ? parseLoudness(loudness.detail) : null,
      balance,
      checks,
      warnings,
      reused,
      videos,
    };
    await c.storage.writeJson(out(c, "qa.json"), qa);
  },
};

// A frame from the first scene once its last spoken word has landed (headlines reveal on the voice).
async function writePoster(video: string, file: string, timing: TimingResult) {
  const first = timing.scenes[0];
  const t = first ? Math.min(first.end - 0.1, Math.max(first.start + first.duration * 0.7, (first.voiceEnd ?? 0) + 0.45), timing.duration - 0.1) : 0;
  await ffmpeg(["-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", file]);
}

// Peak level per bucket (0-1), for drawing the audio under the editor's timeline.
async function waveform(file: string, duration: number, buckets = 600): Promise<{ duration: number; peaks: number[] }> {
  const samples = await decodeMono(file, 8000);
  const size = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    for (let j = i * size; j < Math.min(samples.length, (i + 1) * size); j++) max = Math.max(max, Math.abs(samples[j]));
    peaks.push(Math.round(max * 1000) / 1000);
  }
  return { duration, peaks };
}

// Reads a finished version back (after the stages ran, possibly in other processes).
export async function loadResult(storage: Storage, outKey: string): Promise<MakeVideoResult> {
  const qa = await storage.readJson<QaReport>(`${outKey}/qa.json`);
  const plan = await storage.readJson<ScenePlan>(`${outKey}/plan.timed.json`);
  const timing = await storage.readJson<TimingResult>(`${outKey}/timing.json`);
  const videos = Object.fromEntries(Object.entries(qa.videos).map(([f, name]) => [f, storage.path(`${outKey}/${name}`)])) as MakeVideoResult["videos"];
  return {
    outDir: storage.path(outKey),
    video: storage.path(`${outKey}/video.mp4`),
    social: storage.exists(`${outKey}/video-social.mp4`) ? storage.path(`${outKey}/video-social.mp4`) : null,
    videos,
    plan,
    timing,
    qa,
  };
}

// The whole pipeline in this process (CLI, MCP, previews).
export { resolveImages };

export async function makeVideo(o: MakeVideoOptions): Promise<MakeVideoResult> {
  const plan = await step("validate", o.onEvent, () => checkRenderPlan(o.plan, o.assetsDir, o.preview));
  const c: StageContext = {
    storage: o.storage,
    audio: o.audio,
    renderer: o.renderer,
    assetsDir: o.assetsDir,
    outKey: o.outKey ?? `projects/${plan.id}/v${plan.version}`,
    planDir: o.planDir,
    options: { quality: o.quality, burnCaptions: o.burnCaptions, social: o.social, preview: o.preview, formats: o.formats },
    onEvent: o.onEvent,
  };
  await c.storage.writeJson(out(c, "plan.json"), plan);
  for (const stage of RENDER_STAGES.slice(1)) await runStage(stage, c);
  return loadResult(c.storage, c.outKey);
}

function parseLoudness(detail: string): Loudness | null {
  const m = /(-?[\d.]+) LUFS, true peak (-?[\d.]+) dBTP/.exec(detail);
  return m ? { integrated: Number(m[1]), truePeak: Number(m[2]) } : null;
}
