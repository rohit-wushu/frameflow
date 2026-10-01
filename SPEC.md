# SPEC.md — Frameflow (working name)

> An AI motion-design tool, like motion.so. The user types one line and gets a finished
> motion-graphics video: script, voiceover, music, sound effects, animation, cuts and
> captions, all automatic. Then they can edit any scene by chat.

You (Claude Code) are building this product end to end. Read this whole file before writing
any code. Work phase by phase (see "Build phases"). At the end of every phase, stop, show me
what works, and wait for my go-ahead.

---

## 1. Core idea: the scene plan

The whole video is driven by ONE JSON file: the **scene plan**.

- The AI director (Claude via the Anthropic API) only WRITES the scene plan.
- It never writes animation code. It picks a template and fills its fields.
- Every other engine (voice, music, SFX, render) only READS the scene plan.
- Editing a scene = changing that scene in the plan and re-running only what depends on it.

If a feature does not fit this model, tell me before building it.

---

## 2. Tech stack

- **Monorepo:** pnpm workspaces, TypeScript everywhere on the Node side.
- **Web app:** Next.js (App Router) + Tailwind + shadcn/ui.
- **Queue:** BullMQ + Redis for background jobs (each pipeline stage = a job).
- **DB:** Postgres + Prisma (projects, scene plans, versions, jobs, assets).
- **Storage:** local `./storage` folder in dev, behind an interface so S3/R2 can be added later.
- **Renderer:** HyperFrames (HTML + GSAP), same as
  https://github.com/bestagentkits/motion-video-skill (MIT). Study that repo first and reuse
  its ideas: composition contract, beat-grid fitting, arrangement check, mix-balance check,
  loudness targets. Put the renderer behind a `Renderer` interface so it can be swapped for
  Remotion later.
- **Python audio service:** FastAPI app in `services/audio` for TTS, alignment and beat
  detection. Node talks to it over HTTP.
- **Media tooling:** ffmpeg + ffprobe.
- **AI director:** Anthropic SDK. Model name comes from env var `DIRECTOR_MODEL`. The API key
  comes from `ANTHROPIC_API_KEY`. No other paid APIs.

Free / open-source only for audio:

| Job | Tool | Notes |
|---|---|---|
| English voice | Kokoro TTS | Apache-2.0, runs on CPU |
| Hindi / Hinglish voice | AI4Bharat Indic Parler-TTS | Add in phase 4 |
| Word timestamps | WhisperX | Forced alignment of the voiceover |
| Beat detection | librosa | BPM, beat grid, downbeats |
| Music (phase 1-3) | Tagged local music library | Royalty-free tracks with mood + BPM tags |
| Music (phase 4) | ACE-Step | Optional, needs GPU. Do NOT use MusicGen (non-commercial weights) |
| SFX | Local CC0 library | whoosh, pop, click, impact, riser, swoosh, ding |

---

## 3. Folder structure

```
frameflow/
├── apps/
│   └── web/                  Next.js app (UI + API routes)
├── packages/
│   ├── scene-schema/         Zod schemas + TS types for the scene plan
│   ├── templates/            Animation template library (one folder per template)
│   ├── director/             AI director: brand research, script, scene plan, validation loop
│   ├── timing/               Scene timing from voice alignment + beat snapping
│   ├── sfx/                  Rule-based SFX placement
│   ├── mixer/                ffmpeg mix: ducking, loudness, final audio
│   ├── renderer/             Renderer interface + HyperFrames implementation
│   └── pipeline/             BullMQ jobs that chain everything
├── services/
│   └── audio/                FastAPI: /tts, /align, /beats
├── assets/
│   ├── music/                Tracks + music.json (mood, bpm, energy, duration, license)
│   └── sfx/                  Sounds + sfx.json
├── storage/                  Generated files (gitignored)
├── SPEC.md
└── CLAUDE.md                 Short working notes for you, keep it updated
```

---

## 4. Scene plan schema

Put this in `packages/scene-schema` as Zod schemas. This is the contract for everything.

```ts
type ScenePlan = {
  id: string;
  version: number;
  title: string;
  format: "16:9" | "9:16" | "1:1";
  targetDuration: number;            // seconds, what the user asked for
  language: "en" | "hi" | "hinglish";
  mood: "energetic" | "calm" | "premium" | "playful" | "serious";
  brand: {
    name: string;
    colors: { primary: string; secondary: string; background: string; text: string };
    font: { heading: string; body: string }; // Google Fonts only
    logoUrl?: string;
  };
  voice: { engine: "kokoro" | "indic-parler"; voiceId: string; speed: number };
  music: { mode: "library" | "generate"; mood: string; bpm?: number; trackId?: string };
  scenes: Scene[];
};

type Scene = {
  id: string;
  template: string;                  // must exist in the template registry
  content: Record<string, unknown>;  // validated against that template's own schema
  voiceover: string;                 // what is spoken during this scene ("" = no voice)
  estDuration: number;               // director's guess
  duration?: number;                 // final, filled by the timing step
  start?: number;                    // final, filled by the timing step
  sfx: { at: "start" | "end" | "each_item" | "on_word"; word?: string; sound: string }[];
  transitionOut: "cut" | "fade" | "slide" | "zoom" | "wipe";
};
```

Rules the validator must enforce:
- `template` exists in the registry, and `content` passes that template's schema.
- Each scene is between the template's `minDuration` and `maxDuration`.
- Sum of `estDuration` is within ±15% of `targetDuration`.
- First scene is a hook template. Last scene is `logo_reveal` or `cta`.
- No two identical templates back to back.
- Every `sfx.sound` exists in `sfx.json`.

---

## 5. Template library

Each template is a folder in `packages/templates/<name>/`:

```
hero_text/
├── meta.ts        name, description, whenToUse, minDuration, maxDuration, category
├── schema.ts      Zod schema for its content fields, with text length limits
├── template.html  HyperFrames composition using GSAP; reads content + brand + timing
├── example.json   Example content, used for previews and tests
└── preview.mp4    Generated by a script, never hand-made
```

Template rules:
- Every template reads colors and fonts from the brand, never hardcoded.
- Every template works in 16:9, 9:16 and 1:1 (responsive layout).
- Animations are driven only by the timing data (scene start, duration, word timestamps),
  so they stay in sync with voice and beats.
- Text reveals can land on specific word timestamps from WhisperX.
- A `registry.ts` exports all templates. A script `pnpm templates:catalog` generates
  `catalog.md` (name, whenToUse, fields, limits) which is fed to the director.
- A script `pnpm templates:preview` renders every template with its `example.json`.

First 12 templates:

| Name | Use |
|---|---|
| `hero_text` | Big bold headline + subtext, openers and hooks |
| `kinetic_words` | Words appear one by one, synced to the voice |
| `problem_list` | 2-4 pain points crossed out or stacked |
| `feature_grid` | 3-4 features with icons (Tabler icons) |
| `feature_spotlight` | One feature, big title + short line + visual |
| `stat_counter` | Big number counting up + label |
| `device_mockup` | Screenshot inside a laptop or phone frame, slow zoom/pan |
| `screenshot_zoom` | Full screenshot, zooms into a highlighted area |
| `comparison` | Before vs after, or us vs them, two columns |
| `testimonial` | Quote + name + role |
| `cta` | Call to action + URL/button |
| `logo_reveal` | Logo animation + tagline, always the ending |

---

## 6. Pipeline

Each step is a BullMQ job. Each job writes its output to storage and updates progress, so the
UI can show live status. If a step fails, retry it, then show a clear error.

1. **Brand research** (optional, if a URL is given): Playwright opens the site, takes a
   screenshot, extracts logo, main colors and fonts, and reads the page text. Save as
   `brand.json`. The user can confirm or edit it.
2. **Director → scene plan**: send Claude the user prompt, brand info, `catalog.md` and the
   rules from section 4. It must return only JSON.
3. **Validation loop**: validate with Zod. If it fails, send the exact errors back to Claude
   and ask it to fix only those. Max 3 attempts, then fail with a readable error.
4. **Voiceover**: call `/tts` for each scene's voiceover. One audio file per scene.
5. **Alignment**: call `/align` to get word-level timestamps per scene.
6. **Music**: library mode picks the best track by mood, energy and duration. Call `/beats`
   to get BPM and the beat grid.
7. **Timing**: final scene duration = voice length + small padding, clamped to the template
   limits. Then snap scene cuts to the nearest beat (max shift 250 ms). Write `start` and
   `duration` back into the plan.
8. **SFX placement**: rules turn plan events into timed SFX cues. Defaults: every cut gets a
   whoosh, each list item gets a pop, `logo_reveal` gets an impact, a riser before the last
   scene. The director can add or override cues.
9. **Mix**: ffmpeg. Music ducks under the voice (sidechaincompress, around 5 dB lower when
   speaking), SFX on top, final loudness around -14 LUFS, true peak ≤ -1 dBFS. Reuse the
   checks from motion-video-skill.
10. **Captions**: build word-level captions from the alignment. Optional burned-in style.
11. **Render**: HyperFrames renders the composition, then remux the final audio mix. Output
    1080p 30 fps MP4 plus a smaller social version.

Editing: when one scene changes, only re-run the steps that depend on it (for example a text
change without a voiceover change skips TTS and alignment). Keep every version of the plan so
the user can undo.

---

## 7. Web app screens

1. **Prompt screen**: big text box, website URL, logo upload, duration (15/30/60/90 s),
   format (16:9, 9:16, 1:1), style/mood, language. One "Generate" button.
2. **Brand check**: shows detected logo, colors and fonts. User can edit before continuing.
3. **Storyboard**: one card per scene with template name, text and voiceover. User can edit
   text, reorder, delete, add a scene, or type a chat instruction. Then "Render".
4. **Progress**: live steps (Writing script, Making voice, Picking music, Rendering...) with
   a progress bar.
5. **Editor**: video player, timeline with scene blocks and the audio waveform, and a chat
   panel ("make scene 2 text bigger", "calmer music", "change the voice"). Download buttons
   for each format.

Keep the UI clean and minimal: dark mode default, lots of space, one clear action per screen.

---

## 8. Build phases

Stop after each phase and show me the result.

**Phase 1 — Engine from the command line**
- Monorepo setup, scene schema, 5 templates (`hero_text`, `feature_grid`, `stat_counter`,
  `cta`, `logo_reveal`), audio service with Kokoro + WhisperX + librosa, library music with
  3 sample tracks, SFX rules, mixer, renderer.
- A CLI: `pnpm make-video ./examples/plan.json` renders an MP4 from a hand-written plan.
- Done when: a 20 s video renders with voice, music, SFX, and cuts on the beat.

**Phase 2 — AI director**
- Director package, catalog generation, validation loop, brand research.
- CLI: `pnpm make-video --prompt "..." --url https://...`
- Done when: one line of text produces a full video with no manual steps, 5 times in a row.

**Phase 3 — Web app**
- Postgres, BullMQ, all 5 screens, per-scene re-render, version history.
- Done when: I can go from prompt to download in the browser, and edit one scene by chat.

**Phase 4 — Upgrades**
- The remaining 7 templates, Hindi/Hinglish voice, ACE-Step music generation (optional GPU),
  all 3 output formats from one plan, batch mode (one template, many videos from a CSV).

**Phase 5 (later) — MCP server**
- Expose "create video" and "edit scene" as MCP tools so Claude can make videos directly.

---

## 9. Rules for you

- Read motion-video-skill's code before building timing, mixing and rendering. Reuse, don't
  reinvent. Keep its MIT license notice where code is reused.
- No paid APIs except Anthropic. Everything else must run locally.
- API keys only in `.env`. Add `.env.example`. Never log keys.
- Write tests for: scene schema validation, timing math, beat snapping, SFX placement.
- Every template must have a passing preview render.
- Keep `CLAUDE.md` updated with commands, decisions and known issues.
- If a tool in this spec does not work as expected, tell me and suggest an alternative
  instead of silently switching.
- Prefer simple, readable code over clever code.
