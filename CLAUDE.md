# CLAUDE.md: Frameflow working notes

Read SPEC.md first. Everything is driven by the scene plan (`packages/scene-schema`): the director
writes it, every engine reads it. Build phase by phase and stop after each one.

## Status

- Phase 1 (engine from the CLI): done and reviewed.
- Phase 2 (AI director): done via the MCP connector — 5 briefs in a row (Tabler/tabler.io 16:9 30 s,
  Stillpoint 9:16 15 s, Notion/notion.so 1:1 30 s, Crumb & Co 9:16 30 s, Linear/linear.app 16:9 30 s)
  → full videos with every QA check passing (2026-09-30). The API director (`--prompt`, needs
  `ANTHROPIC_API_KEY`) is unit-tested but has not run live yet (no key in .env).
- Phase 3 (web app): done and tested end to end in a browser (Playwright): sign up → prompt → brand check →
  storyboard → render → editor → chat edit (new version, audio reused) → restore an older version → download.
  Tested with `DIRECTOR_FAKE=1` (no API key yet), so the real Claude director has still not run from the web app.
- Phase 4 (upgrades): 12 templates (all previews pass in 16:9 / 9:16 / 1:1), image assets (website screenshots with
  named zoom regions), all formats from one plan, batch mode (CLI + web), Hindi / Hinglish (on Kokoro's Hindi voices;
  the spec's Indic Parler-TTS needs a Hugging Face token, see "Hindi"). ACE-Step is not built (needs a GPU).
- Phase 5 (MCP server) pulled forward on request: `apps/mcp`, local (stdio) and claude.ai custom connector (HTTP).

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install JS deps (pnpm downloads Node 22 for this repo; see Decisions); also generates the Prisma client |
| `pnpm db:migrate` | Apply / create Prisma migrations (Postgres from `DATABASE_URL`) |
| `pnpm dev` | Web app (http://localhost:3210) + worker together. Or separately: `pnpm web`, `pnpm worker` |
| `DIRECTOR_FAKE=1 pnpm worker` | Worker with a stand-in director (template examples + keyword edits), for testing without an API key. Never for real users |
| `pnpm audio:setup` | Create the Python 3.12 env for `services/audio` (uv) |
| `pnpm audio:start` | Run the audio service on 127.0.0.1:8790 (the CLI also starts it on demand) |
| `pnpm make-video ./examples/plan.json` | Plan → MP4. Flags: `--draft`, `--captions`, `--no-social` |
| `pnpm make-video --prompt "..." [--url https://...]` | One line → MP4 via the director. `--duration 15/30/60/90`, `--format`, `--mood`, `--language en/hi/hinglish`, `--brand brand.json` |
| `pnpm make-video plan.json --csv rows.csv` | Batch: one video per CSV row, filling the plan's `{{column}}` placeholders (example: `examples/batch/`) |
| `... --formats 9:16,1:1` | Also render these formats from the same plan and audio (`video-9x16.mp4`, `video-1x1.mp4`) |
| `pnpm connector` | claude.ai custom connector: Cloudflare quick tunnel + HTTP MCP server; prints the URL to paste |
| `pnpm mcp` / `pnpm mcp:http` | MCP server over stdio (Claude Desktop/Code) / HTTP on 127.0.0.1:8791 (no tunnel) |
| `pnpm templates:catalog` | Regenerate `packages/templates/catalog.md` (fed to the director) |
| `pnpm templates:preview [name...]` | Render every template's `example.json` to `<template>/preview.mp4` + 9:16 / 1:1 stills in `storage/previews/` |
| `pnpm test` | Vitest: schema validation, timing, beat snapping, SFX placement, captions, registry |
| `pnpm audio:test` | Python tests: beat detection on synthetic audio, alignment helpers |
| `pnpm typecheck` | `tsc --noEmit` over all packages |

Rebuilding the asset libraries (only when changing them):
`cd services/audio && uv run python scripts/build_sfx_library.py` and `... build_music_library.py`.

Outputs go to `storage/projects/<plan id>/v<version>/`: `video.mp4`, `video-social.mp4`, `mix.m4a`,
`plan.json`, `plan.timed.json`, `timing.json`, `sfx-cues.json`, `captions.{json,srt,vtt}`,
`qa.json` (measured checks), `credits.txt`, `work/` (mix graph, stems, composition, hyperframes.log).
Caches (content-hashed, safe to delete): `storage/cache/{tts,align,beats,fonts,logos}`.

## How a render flows

(brand research → director →) validate → voiceover (/tts per scene) → alignment (/align) → music (library pick + /beats) →
timing → SFX cues → mix → captions → render (HyperFrames) → remux + social encode + checks.
`packages/pipeline/src/make-video.ts` is the whole chain; each step is a function so phase 3 can
wrap them as BullMQ jobs.

## Decisions

- **Node 22 for this repo only.** HyperFrames 0.7.99 needs Node ≥ 22; the Mac has Node 20.
  `devEngines.runtime` in package.json makes pnpm download and use Node 22. System Node untouched.
- **Audio service**: Python 3.12 via uv (Kokoro/WhisperX lag on 3.13). Port **8790**, because a local
  PHP server already uses 8765.
- **WhisperX = alignment only.** We know the script, so we skip speech recognition and run only the
  wav2vec2 forced alignment. Numbers/symbols are spelled out for alignment ("40%" → "forty percent")
  and timings folded back onto the written words.
- **Beats**: librosa tracks the tempo; we then fix off-beat locks (kicks half a beat away → shift)
  and snap each beat to its kick onset. Motivator 126.05 / Inspired 120.19 / Life of Riley 101.83 BPM.
- **Music library**: FreePD (first choice) has shut down and its archive.org mirrors contain
  copyrighted tracks, so the user chose **Incompetech (Kevin MacLeod), CC BY 4.0**. Attribution is
  required: it is stored in `music.json` and written to `credits.txt` next to every render.
- **SFX library**: pop/click/ding from Kenney Interface Sounds (CC0); whoosh/swoosh/riser/impact are
  synthesized by our script (CC0). Every sound has a `hitOffset` (file start → peak) so the peak, not
  the file start, lands on the event.
- **Timing** (`packages/timing`): voice starts 0.2 s after its cut; natural cut = voice end + 0.35 s;
  clamp to template limits; snap the cut to the nearest beat within ±250 ms but never earlier than
  voice end + 0.12 s (so no clipped words). **Deviation from SPEC's "max shift 250 ms":** when the
  beats within ±250 ms are all on the blocked side (voice still speaking, or below the template's
  minimum), the cut waits for the next beat, at most 0.65 s later (`maxForward`); without this ~1 in 5
  cuts stayed off-beat. Last scene holds 1 s extra; a list scene stays up ≥ 1 s
  after its last item appears (≥ 0.75 s after snapping), since the last item is often the last word. If a voice is longer than the
  template's max, the scene is stretched (with a warning) rather than cutting the voice. The music is
  trimmed to start on its first downbeat, so video t = 0 is a downbeat.
- **SFX rules** (`packages/sfx`): whoosh on every cut (not into the first scene), pop per list item,
  the template's `accentSound` on its accent (logo_reveal → impact, cta → click), riser ending at the
  last cut. A director cue with the same `at` as a default replaces it for that scene; others add.
- **Mix** (ported from motion-video-skill): voice → −16 LUFS per file, then a −1 dBFS limiter on the
  voice bus (Kokoro is ~−25 LUFS with hot peaks; the reference's peak-capped gain left some scenes
  4 dB quiet). Music segment → −16 LUFS, sidechain-ducked by the voice (threshold 0.03, ratio 3,
  attack 15, release 350); SFX at their cue volume; 1.5 s fade; two-pass loudnorm to −14 LUFS /
  −1.5 dBTP; AAC 192k 48 kHz.
- **Balance loop**: the music-under-voice balance (target 5 dB, pass 4–6) depends on which part of
  the track sits under the speech, so a fixed music gain landed anywhere from 4 to 9.6 dB. The mixer
  now measures it from stems and corrects the music gain once (ducking is keyed by the voice only,
  so the correction is exact). Adds one ~3 s mix pass.
- **Renderer**: one HyperFrames `index.html` per video, built by `packages/renderer/src/hyperframes`.
  Templates are `template.html` fragments that call `FF.register(name, build)`; the shell
  (`runtime.js`) owns scene visibility, transitions, background, captions and fades. Contract from
  motion-video-skill: all times from `window.TIMING`, no clock, seeded rng only, DOM built before
  tweens, one paused timeline `window.__timelines["main"]`. GSAP and fonts are local files.
  HyperFrames is pinned to 0.7.99; telemetry and update checks are turned off by env vars.
  The render's re-encoded audio is replaced by the untouched mix (remux), as the reference does.
- **Template text sizing** is computed from character counts (`h.fit`), not DOM measurement, so it
  is deterministic before fonts load.
- **Validation** reports every error in one pass (even when the base schema fails) so the director's
  3-attempt fix loop converges faster. `planRules: false` skips whole-video rules for previews.
- pnpm `allowBuilds`: HyperFrames' AI extras (`onnxruntime-node`, `@google/genai`, `protobufjs`)
  are not allowed to run install scripts; rendering does not need them.
- Code reused from motion-video-skill (MIT) keeps its notice at the top of: `mixer/src/mix.ts`,
  `mixer/src/checks.ts`, `renderer/src/video.ts`, `renderer/src/hyperframes/runtime.js`,
  `services/audio/tests/test_beats.py`.

## Web app (phase 3)

- Processes: **web** (`apps/web`, Next.js 16 App Router + Tailwind 4 + shadcn/ui, port 3210) only does UI, auth,
  database rows and queueing; **worker** (`apps/worker`) runs everything heavy. The web app never imports the
  engine: it reads `src/generated/catalog.json` (templates + JSON schemas + examples, voices, fonts; written by
  `apps/web/scripts/catalog.mts` before dev/build) and validates plans by asking the worker (`check` queue).
- Queues (`packages/jobs`, BullMQ 6 on Redis db 5, prefix `frameflow`): `media` (brand research + render stages,
  concurrency 1 because of Chrome + audio models on 8 GB), `ai` (director plans and chat edits, 3), `check` (8).
  BullMQ 6 needs an ioredis client instance (not connection options) in ESM.
- **A render is a BullMQ flow, one job per stage** (validate → voiceover → alignment → music → timing → sfx → mix →
  captions → render → finish). `packages/pipeline` `runStage()` runs one stage; each reads what earlier stages wrote
  into `projects/<id>/v<n>/` (voices.json, alignment.json, music.json, timing.json, sfx-cues.json, mix.m4a,
  warnings.json, reused.json, ...). A stage retries once on its own; a failure fails the rest of the flow.
  `makeVideo()` (CLI, MCP, previews) runs the same stages in one process.
- Edits re-run only what changed: TTS and alignment are cached per scene, and the **mix is cached by its inputs**
  (`cache/mix/<hash>`), so a text-only edit reuses voice, timings and mix; only render + finish run (~30 s).
  `qa.json` `reused` lists what was reused; the UI shows it.
- Database (`packages/db`, Prisma 7 with the `prisma-client` generator + `@prisma/adapter-pg`, Postgres 17 from
  Homebrew): User, Session, BrandKit, Upload, Project (the working plan = storyboard), Version (every render; undo =
  restore one, no re-render), Job (mirrors BullMQ for live progress and quotas), ChatMessage.
- Auth: email + password (scrypt), database sessions; the cookie holds a random token, the DB only its SHA-256.
  `proxy.ts` (Next 16's middleware) only checks the cookie exists; every page/action calls `requireUser()` /
  `ownProject()`. Login and sign-up are rate-limited in Redis. `SIGNUP_CODE` makes sign-up invite-only.
- Quotas (`packages/db/src/limits.ts`): renders per month by tier (`FREE_/PRO_RENDERS_PER_MONTH`), director calls per
  day (`AI_CALLS_PER_DAY`); failed jobs don't count. No payment provider yet (needs a decision: paid service).
- Files: `/api/files/<storage key>` serves only finished outputs, research images and the user's own uploads, after
  an ownership check, with Range support and a sandboxing CSP. Uploads: PNG/JPEG/WebP/SVG ≤ 2 MB, sniffed by
  content; SVGs with scripts are refused.
- **SSRF**: user URLs (website, logo) are checked (`packages/director/src/net-guard.ts`): http(s) on 80/443 only,
  no private/loopback/link-local/metadata addresses, checked again at connect time (no DNS rebinding). Brand
  research's Chrome goes through a local guard proxy, and WebRTC is limited to the proxy.
- Chat edits: `revisePlan()` (director) gets the current plan, the instruction and the selected scene, returns
  `{summary, plan}`; same check-and-fix loop; id, version, format, language and logo are pinned. Scenes have an
  optional `textScale` (0.7-1.4) so "make the text bigger" works (main text only; long text still shrinks to fit).
- Next 16 notes: `params`/`cookies()` are async; `PageProps`/`RouteContext` come from `next typegen`; Turbopack
  does not map `./x.js` imports to `.ts`, so packages the web app bundles (`scene-schema`, `db`, `jobs`) use
  extensionless relative imports. Chrome's `scrollIntoView` returns a Promise: never return it from an effect.
- Next dev loads `@frameflow/db` in several bundles: they must share the one client on globalThis (a check like
  `instanceof PrismaClient` made them replace each other and exhausted Postgres connections). `db()` only replaces
  a cached client that lacks a model of the current schema (after `prisma generate`).
- File responses use a small cancel-aware stream (`fileStream` in the files route): `Readable.toWeb` threw
  uncaught "Controller is already closed" errors whenever the video player cancelled a request on seek.
- The worker re-checks the audio service before every audio stage and restarts it if it died.

## Phase 4

- **Templates (12)**: hero_text, kinetic_words (hooks); problem_list, feature_grid, feature_spotlight, stat_counter,
  device_mockup, screenshot_zoom, comparison, testimonial (content); cta, logo_reveal (end). Text-only templates draw
  their own small marks (inline SVG), so they need no icon. testimonial: the director may only use real quotes.
- **Images** (`plan.assets`): `{name: {file, width, height, description, regions}}`; scenes refer to an image by name
  (`content.image`), screenshot_zoom's `content.focus` is a region name or center/top. The engine fills `assets`
  (the director never writes file paths): brand research now takes a 2x desktop screenshot with named regions
  (headline, button, nav, image, found by `page-scan.js`) and a phone screenshot (`website-mobile`). The validator
  checks image and region names. Previews use screenshots of a made-up product page
  (`packages/templates/_assets/mock-site.html`, rendered by `scripts/example-assets.ts`), not a real site.
- **All formats from one plan**: the render stage renders extra formats from the same timed plan and mix
  (`formats` option; web: Download tab → "Also make it in"; CLI `--formats`; MCP `formats`).
- **Batch mode** (`scene-schema/src/batch.ts`): RFC 4180 CSV parser, `{{column}}` placeholders anywhere in the
  plan's text (never in file paths), every filled row is checked with the director's rules before anything renders.
  Web: `/batch` (≤ 100 rows, counts against the monthly renders, a Batch row groups the projects).
- **Hindi / Hinglish**: `language` is pinned from the brief; the director writes Devanagari (Hinglish: everyday
  English words also in Devanagari, which the Hindi voice reads well; Latin English words come out Hindi-accented).
  Voices must match the language (validator). Fonts: brand fonts keep their Devanagari subset and Noto Sans
  Devanagari is the fallback. Word normalization keeps combining marks (vowel signs). Text fitting counts graphemes.
- **Hindi decision pending (user)**: the spec names AI4Bharat Indic Parler-TTS. It is Apache-2.0 but *gated* on
  Hugging Face (needs an account + token in .env), and so is the only commercially licensed Hindi aligner found
  (ai4bharat/indicwav2vec-hindi; WhisperX's default Hindi model has no license, Meta MMS is non-commercial).
  Until the user decides, Hindi uses **Kokoro's Hindi voices** (hf_alpha, hf_beta, hm_omega, hm_psi; Apache-2.0,
  espeak-ng G2P; ~2.6 words/s; Whisper heard the test sentences back nearly verbatim, a few retroflex sounds blur)
  and **estimated word timings** (`align.estimate`: pauses in the audio + word length), so Hindi word-synced
  reveals and captions are approximate. Cuts are unaffected (they come from clip lengths).
- **ACE-Step** (music generation): not built; it needs a GPU this machine doesn't have. `music.mode = "generate"`
  still fails with a clear message.

## Director (phase 2)

- `packages/director`: `researchBrand()` (Playwright: screenshot, logo, colors, fonts, page text →
  `storage/research/<site>/brand.json`), `writePlan()` (Claude writes the plan as JSON; our validator
  checks it; errors go back in a fresh request with the previous plan; max 3 attempts), `anthropicLlm()`.
- Model from `DIRECTOR_MODEL` (default `claude-opus-5-5`), effort from `DIRECTOR_EFFORT` (default
  `medium`). Server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`)
  is on for models that support it. Every attempt (raw reply, errors, model, tokens) is saved in
  `storage/projects/<id>/v1/director.json`.
- Plain JSON + our validator instead of structured outputs: `content` differs per template and several
  rules (icon names, highlight word, pacing) are not expressible in a JSON schema.
- The prompt contains the rules, `buildCatalog()` (same text as catalog.md), voices, transitions,
  sounds and ~125 common Tabler icons. Wrong icon names get "close matches" in the error.
- Pacing rule (director output only, `SpeechModel` in scene-schema): spoken words (numbers read out:
  "41.8k" = 5, "$30" = 2, "1998" = 3) / the voice's measured rate (options.ts: af_heart 3.4 … af_nicole
  2.2 words/s; unmeasured voices 2.6) + 0.27 s per comma/period + 0.55 s scene overhead. Fitted on 32
  real clips: mean error 0.37 s, worst 1.0 s short, hence a 0.5 s margin under each template's max.
  estDuration must match the spoken length within 1.2 s. (A flat 3 words/s let two scenes overrun.)
- The director only uses facts from the brief and the website text (no invented stats/testimonials).
- Fields the user chose are pinned after the director answers: format, duration, language, mood (if
  given), and the researched brand (the director can't change it).
- Brand research: colors from computed styles (buttons/links weighted as accents); inline SVG logos get
  their painted colors baked in (sites use CSS variables); fonts map to Google Fonts by trying name
  variants ("Inter Variable" → Inter, "GeistSans" → Geist), else Inter. Square logos get the brand
  name next to them in logo_reveal; wide logos are sized explicitly (an SVG's own size is its size on
  the website, often ~110 px).

## MCP connector (Claude is the director)

- `apps/mcp/src/server.ts` registers the tools: get_video_guide, research_brand, check_plan, create_video,
  get_video, get_project, list_projects, edit_scene, revise_video. Same engine and checks as the CLI
  (`checkPlan` from packages/director). Server instructions tell Claude the workflow.
- Renders run in a single in-process queue (`jobs.ts`); create/edit tools wait up to 45 s, then return a
  job_id for get_video (long-poll, MCP progress notifications). Finished results include a frame per
  scene as images so Claude can check the video by eye.
- Every edit is a new version (`projects/<id>/v<n>`), so earlier versions stay for undo (get_project
  with `version`). Unchanged voiceovers hit the TTS/alignment cache.
- Local: Claude Code `claude mcp add frameflow -- pnpm --silent --dir "<repo>" mcp`; Claude Desktop config
  command `/opt/homebrew/bin/pnpm`, args `["--silent", "--dir", "<repo>", "mcp"]`. `--silent` matters:
  stdout is the protocol channel (the server also redirects console.log to stderr).
- claude.ai: `pnpm connector` runs `cloudflared` quick tunnel → 127.0.0.1:8791 and prints
  `https://<random>.trycloudflare.com/mcp/<token>`. Access control is the secret path token
  (storage/mcp-token.txt, created once; delete it to revoke; or set FRAMEFLOW_MCP_TOKEN). Files are
  served only for finished outputs (video, social, captions, credits) under `/files/<token>/`.
  Host-header check: 127.0.0.1/localhost + the tunnel host. Quick-tunnel hostnames change on every
  start, so the connector URL must be updated in claude.ai after a restart; a named Cloudflare tunnel
  (needs an account + domain) would make it stable.
- Mix fix (2026-10-01): the music used to stop at the last spoken word (sidechaincompress ends with its sidechain);
  the voice bus is now padded to the full length, so music plays through the end hold and fades.
- Memory: before rendering, the pipeline calls the audio service's `/unload` so Chrome has room (models
  reload in ~10 s on the next request); a crashed render ("Target closed") is retried once; brand
  research stops after 120 s.

## Adding a template

Folder `packages/templates/<name>/` with `meta.ts`, `schema.ts` (Zod, with text limits),
`template.html` (a `<style>` scoped to `.t-<name>` + `FF.register`), `example.json`. Register it in
`registry.ts`, then `pnpm templates:catalog` and `pnpm templates:preview <name>`. Rules: colors only
from brand tokens (`--primary`, `--text`, ...; the registry test rejects hex colors in CSS), layout
must work in 16:9 / 9:16 / 1:1 (`ctx.format`, `[data-format]`), times only from `ctx` (t0, words,
items, accent, beats).

## Known issues / limits

- 8 GB M1: HyperFrames runs in low-memory mode (1 Chrome worker). With other apps open the Mac swaps
  heavily (12 GB swap seen); a render crashed once under that pressure before the unload/retry fixes.
- First `/tts` and `/align` calls download models (~700 MB) and take 1-2 minutes; later calls are fast.
- A brand font is fetched from Google Fonts the first time it is used (then cached).
- Hindi runs on Kokoro + estimated word timings until the Indic Parler-TTS decision (see Phase 4).
- 9:16 with a landscape screenshot (screenshot_zoom, laptop/browser mockups) leaves the image small; the director
  is told to use the phone screenshot for 9:16.
- ACE-Step music generation needs a GPU; it will not run on this machine.
- Some sites (e.g. vercel.com) serve a bot check to headless browsers: little text, no logo. The
  run continues with a wordmark and notes; pass `--brand brand.json` with fixes if needed.
- "Life of Riley" has a looser beat (±42 ms spacing jitter); cuts still land within a frame or two.
