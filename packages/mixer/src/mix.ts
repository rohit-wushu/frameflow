// Final audio mix: ducked music + voiceover + SFX, loudness-normalized.
// The filter graph and the numbers are ported from motion-video-skill's build-timeline.mjs,
// Copyright (c) 2026 BestAgentKits, MIT License. https://github.com/bestagentkits/motion-video-skill
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BALANCE_TARGET, measureLoudness, mixBalance, type MixBalance } from "./checks.js";
import { ffmpeg, ffmpegReport, probeDuration } from "./ffmpeg.js";

export const MIX_SETTINGS = {
  voiceLufs: -16, // each scene's voice file is brought to this...
  // ...and the voice bus is then peak-limited to -1 dBFS. Kokoro's voice comes out around -25 LUFS
  // with peaks up to -6 dBTP, so capping the gain at the peak (as the reference does) left some
  // scenes 4 dB quiet; a limiter on brief peaks keeps every scene at the same level.
  voiceLimiter: "alimiter=limit=0.891:attack=5:release=50:level=0:latency=1",
  musicLufs: -16, // the used part of the music track is brought to this, then...
  musicGainDb: 2, // ...offset by this as a first guess; the balance loop then corrects it
  duck: "sidechaincompress=threshold=0.03:ratio=3:attack=15:release=350:makeup=1", // keyed by the voice bus
  finalLoudnorm: "loudnorm=I=-14:TP=-1.5:LRA=11",
  fadeOut: 1.5,
  graph: 2, // bump when the filter graph changes, so cached mixes are rebuilt
};
const FMT = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
const BALANCE_TOLERANCE = 0.4; // dB; within this of the target, no second pass

export interface MixInput {
  duration: number;
  music?: { file: string; offset: number }; // offset: seconds into the track that play at video t = 0
  voices: { file: string; at: number }[];
  sfx: { file: string; t: number; vol: number }[]; // t < 0 trims the head of the sound
  workDir: string;
  outFile: string; // .m4a (AAC 48 kHz)
  // When set, the music level is measured against the voice during `speech` and corrected so the
  // music sits `target` dB under the voice (one extra pass at most). Writes stems.
  balance?: { speech: [number, number][]; target?: number };
}

export interface MixResult {
  outFile: string;
  premixLufs: number;
  musicGainDb: number | null; // the music gain that was used, relative to musicLufs
  balance: MixBalance | null;
  stems?: { music: string; voice: string };
}

const ms = (t: number) => Math.max(0, Math.round(t * 1000));

// Gain (dB) that brings a file (or the [start, length] part of it) to `target` LUFS.
// With capPeak, the gain never pushes the file's peak above -1 dBFS.
async function gainFor(file: string, target: number, opts: { trim?: { start: number; length: number; workDir: string }; capPeak: boolean }): Promise<number> {
  let source = file;
  if (opts.trim) {
    source = join(opts.trim.workDir, "music-segment.wav");
    await ffmpeg(["-ss", String(opts.trim.start), "-t", String(opts.trim.length), "-i", file, source]);
  }
  const { integrated, truePeak } = await measureLoudness(source);
  if (!Number.isFinite(integrated) || integrated < -60) return 0; // too short or silent to measure
  const gain = Math.min(target - integrated, 20);
  return opts.capPeak ? Math.min(gain, -1 - truePeak) : gain;
}

export async function mix(input: MixInput): Promise<MixResult> {
  const { duration: D, workDir } = input;
  await mkdir(workDir, { recursive: true });

  // measure every input once
  let musicLevel: number | null = null; // dB that brings the used music segment to musicLufs
  let trackLength = 0;
  if (input.music) {
    trackLength = await probeDuration(input.music.file);
    const used = { start: input.music.offset, length: Math.min(D, trackLength - input.music.offset), workDir };
    musicLevel = await gainFor(input.music.file, MIX_SETTINGS.musicLufs, { trim: used, capPeak: true });
  }
  const voiceGains = await Promise.all(input.voices.map((v) => gainFor(v.file, MIX_SETTINGS.voiceLufs, { capPeak: false }))); // the bus limiter handles peaks
  const wantStems = !!input.balance && musicLevel !== null && input.voices.length > 0;

  // one premix pass with the music at `musicGainDb` (relative to musicLufs)
  const premix = join(workDir, "premix.wav");
  const stems = wantStems ? { music: join(workDir, "stem-music.wav"), voice: join(workDir, "stem-voice.wav") } : undefined;
  const renderPremix = async (musicGainDb: number) => {
    const inputs: string[][] = []; // ffmpeg input args per input
    const graph: string[] = [];
    const add = (file: string, pre: string[] = []) => inputs.push([...pre, "-i", file]) - 1;

    // music: the used segment, level-matched, with a tiny fade-in so it cannot click
    let musicLabel: string | null = null;
    if (input.music && musicLevel !== null) {
      const loop = input.music.offset + D > trackLength ? ["-stream_loop", "-1"] : [];
      const idx = add(input.music.file, loop);
      const g = musicLevel + musicGainDb;
      graph.push(`[${idx}:a]${FMT},atrim=start=${input.music.offset.toFixed(4)}:duration=${D},asetpts=PTS-STARTPTS,volume=${g.toFixed(2)}dB,afade=t=in:d=0.03[mus]`);
      musicLabel = "[mus]";
    }

    // voice: one input per scene file, each placed at its start time, then one limited bus
    const voiceLabels = input.voices.map((v, i) => {
      const idx = add(v.file);
      graph.push(`[${idx}:a]${FMT},volume=${voiceGains[i].toFixed(2)}dB,afade=t=in:d=0.01,adelay=delays=${ms(v.at)}:all=1[v${idx}]`);
      return `[v${idx}]`;
    });
    const busOuts: string[] = [];
    if (voiceLabels.length) {
      const outs = ["[vobus]", "[voside]", ...(stems ? ["[vostem]"] : [])];
      // padded to the full length: sidechaincompress stops when its sidechain ends, which cut the
      // music off at the last word instead of letting it play through the end hold and fade
      graph.push(`${voiceLabels.join("")}amix=inputs=${voiceLabels.length}:normalize=0:dropout_transition=0,${MIX_SETTINGS.voiceLimiter},apad=whole_dur=${D},asplit=${outs.length}${outs.join("")}`);
    }

    // moderate ducking: music ~5 dB under speech, back to near voice level in the gaps
    if (musicLabel && voiceLabels.length) {
      graph.push(stems ? `${musicLabel}[voside]${MIX_SETTINGS.duck},asplit=2[musd][musstem]` : `${musicLabel}[voside]${MIX_SETTINGS.duck}[musd]`);
      busOuts.push("[musd]");
    } else if (musicLabel) {
      busOuts.push(musicLabel);
    } else if (voiceLabels.length) {
      graph.push("[voside]anullsink");
    }
    if (voiceLabels.length) busOuts.push("[vobus]");

    // sound effects: one input per distinct file, split per cue
    const byFile = new Map<string, MixInput["sfx"]>();
    for (const c of input.sfx) byFile.set(c.file, [...(byFile.get(c.file) ?? []), c]);
    for (const [file, cues] of byFile) {
      const idx = add(file);
      const outs = cues.map((_, j) => `[x${idx}_${j}]`);
      graph.push(`[${idx}:a]${FMT},asplit=${outs.length}${outs.join("")}`);
      cues.forEach((c, j) => {
        const head = c.t < 0 ? `atrim=start=${(-c.t).toFixed(4)},asetpts=PTS-STARTPTS,` : "";
        graph.push(`[x${idx}_${j}]${head}volume=${c.vol},adelay=delays=${ms(c.t)}:all=1[xl${idx}_${j}]`);
        busOuts.push(`[xl${idx}_${j}]`);
      });
    }
    if (!busOuts.length) throw new Error("mix: nothing to mix (no music, voice or SFX)");

    const fade = Math.min(MIX_SETTINGS.fadeOut, D / 4);
    graph.push(
      `${busOuts.join("")}amix=inputs=${busOuts.length}:normalize=0:dropout_transition=0,` +
        `afade=t=out:st=${(D - fade).toFixed(3)}:d=${fade.toFixed(3)},atrim=0:${D},apad=whole_dur=${D}[out]`,
    );
    const graphFile = join(workDir, "mix-graph.txt");
    await writeFile(graphFile, graph.join(";\n"));
    const stemArgs = stems ? ["-map", "[musstem]", "-c:a", "pcm_s16le", stems.music, "-map", "[vostem]", "-c:a", "pcm_s16le", stems.voice] : [];
    await ffmpeg([...inputs.flat(), "-/filter_complex", graphFile, "-map", "[out]", "-c:a", "pcm_s16le", premix, ...stemArgs]);
  };

  // measure, don't trust: correct the music level once so it sits `target` dB under the voice.
  // Ducking is keyed by the voice only, so a music gain change shifts the result one-for-one.
  let musicGainDb = MIX_SETTINGS.musicGainDb;
  await renderPremix(musicGainDb);
  let balance: MixBalance | null = null;
  if (stems && input.balance) {
    const target = input.balance.target ?? (BALANCE_TARGET.min + BALANCE_TARGET.max) / 2;
    balance = await mixBalance(stems.music, stems.voice, input.balance.speech);
    const error = balance.musicBelowVoice - target;
    if (Number.isFinite(error) && Math.abs(error) > BALANCE_TOLERANCE) {
      musicGainDb += Math.max(-10, Math.min(10, error));
      await renderPremix(musicGainDb);
      balance = await mixBalance(stems.music, stems.voice, input.balance.speech);
    }
  }

  // two-pass loudness normalization to -14 LUFS / -1.5 dBTP
  const LN = MIX_SETTINGS.finalLoudnorm;
  const report = await ffmpegReport(["-i", premix, "-af", `${LN}:print_format=json`, "-f", "null", "-"]);
  const m = JSON.parse(/\{[\s\S]*?\}/.exec(report.split("[Parsed_loudnorm")[1])![0]);
  const pass2 = `${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await ffmpeg(["-i", premix, "-af", pass2, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", input.outFile]);
  return { outFile: input.outFile, premixLufs: Number(m.input_i), musicGainDb: musicLevel === null ? null : musicGainDb, balance, stems };
}
