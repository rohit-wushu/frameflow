import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SfxSound } from "@frameflow/sfx";

export interface MusicTrack {
  id: string;
  title: string;
  file: string;
  moods: string[];
  energy: number; // 0..1
  bpm: number;
  duration: number;
  license: string;
  attribution: string;
}

export async function loadMusicLibrary(assetsDir: string): Promise<MusicTrack[]> {
  const { tracks } = JSON.parse(await readFile(join(assetsDir, "music", "music.json"), "utf8")) as { tracks: MusicTrack[] };
  return tracks;
}

export async function loadSfxLibrary(assetsDir: string): Promise<SfxSound[]> {
  const { sounds } = JSON.parse(await readFile(join(assetsDir, "sfx", "sfx.json"), "utf8")) as { sounds: SfxSound[] };
  return sounds;
}

const MOOD_ENERGY: Record<string, number> = { energetic: 0.85, playful: 0.65, premium: 0.5, serious: 0.45, calm: 0.3 };

// Library mode: the best track by mood, then energy, BPM (if asked) and length.
export function pickTrack(tracks: MusicTrack[], want: { mood: string; planMood: string; bpm?: number; trackId?: string; minDuration: number }): MusicTrack {
  if (want.trackId) {
    const t = tracks.find((x) => x.id === want.trackId);
    if (!t) throw new Error(`music track "${want.trackId}" is not in the library; available: ${tracks.map((x) => x.id).join(", ")}`);
    return t;
  }
  const mood = want.mood.toLowerCase();
  const energy = MOOD_ENERGY[mood] ?? MOOD_ENERGY[want.planMood] ?? 0.6;
  const score = (t: MusicTrack) =>
    (t.moods.includes(mood) || t.moods.includes(want.planMood) ? 0 : 10) +
    Math.abs(t.energy - energy) * 3 +
    (want.bpm ? Math.abs(t.bpm - want.bpm) / 20 : 0) +
    (t.duration < want.minDuration ? 5 : 0);
  return [...tracks].sort((a, b) => score(a) - score(b))[0];
}
