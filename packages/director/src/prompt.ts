import { LANGUAGE_INFO, LANGUAGES, MOODS, VOICE_STYLES, type Asset, type Brand, type Format, type Language, type Mood } from "@frameflow/scene-schema";
import { commonIcons } from "@frameflow/templates";
import { buildCatalog } from "@frameflow/templates/catalog";
import { researchAssets, type BrandResearch } from "./brand.js";
import { languageNote, PAUSE_SECONDS, TRANSITION_NOTES, VOICES, voiceRate, voicesFor } from "./options.js";

export type { Language };

export interface Sound {
  id: string;
  description: string;
}

export interface Brief {
  language?: Language; // default English
  prompt: string;
  durationSec: number;
  format: Format;
  mood?: Mood;
  brand?: Brand | null; // fixed brand (from research or a brand.json); null = the director proposes one
  research?: BrandResearch | null; // website facts
}

const API_INTRO = `You are the director of Frameflow, a tool that turns one line of text into a finished motion-graphics video.
You write the video's scene plan: a JSON document. You never write animation code; each scene picks a template from
the catalog below and fills in its fields. Voice, music, sound effects, timing and rendering are done by other engines
that read your plan.

# Output
Return only JSON: one object, no prose, no markdown code fences. The request says which object.`;

const TOOL_INTRO = `# How to direct a Frameflow video
Frameflow turns a scene plan (a JSON document) into a finished motion-graphics video with voiceover, music on the
beat, sound effects and captions. You write the plan; you never write animation code: each scene picks a template
from the catalog below and fills in its fields. Voice, music, sound effects, timing and rendering are automatic.

Workflow: if there is a website, call research_brand first and copy its brand object into the plan unchanged. Write the
plan, call check_plan and fix every problem it reports, then call create_video and get_video. To change a finished video,
call get_project and edit_scene. Ask the user for anything important you can't infer (the product, the length, the format).

# The plan`;

// Stable across requests (so it can be cached): the job, the rules, and everything to choose from.
// mode "api": the system prompt of the API director. mode "tool": the guide returned by the MCP connector.
export function systemPrompt(sounds: Sound[], musicMoods: string[], overhead: number, mode: "api" | "tool" = "api"): string {
  const toolFields =
    mode === "tool"
      ? `\n  "format": "16:9" | "9:16" | "1:1",\n  "targetDuration": seconds (15, 30, 60 or 90),\n  "language": one of ${LANGUAGES.map((l) => `"${l}"`).join(" | ")} (${LANGUAGES.map((l) => `${l} = ${LANGUAGE_INFO[l].name}`).join(", ")}),\n  "assets": research_brand's assets object, unchanged (only when there was a website; image templates refer to its names),`
      : "";
  return `${mode === "api" ? API_INTRO : TOOL_INTRO}

{
  "title": "short internal title",${toolFields}
  "mood": one of ${MOODS.map((m) => `"${m}"`).join(" | ")},
  "brand": { "name": "...", "colors": { "primary": "#RRGGBB", "secondary": "#RRGGBB", "background": "#RRGGBB", "text": "#RRGGBB" },
             "font": { "heading": "Google Font family", "body": "Google Font family" } },
  "voice": { "engine": "kokoro" for Kokoro voices, "indic-parler" for pr_ voices, "voiceId": "one of the voices below", "speed": 1.0 },
  "music": { "mode": "library", "mood": one of ${musicMoods.map((m) => `"${m}"`).join(" | ")} },
  "scenes": [
    { "id": "short-slug", "template": "template name", "content": { ...that template's fields... },
      "voiceover": "what the narrator says during this scene", "estDuration": seconds,
      "sfx": [], "transitionOut": "cut" | "fade" | "slide" | "zoom" | "wipe",
      "textScale": optional, 0.7 to 1.4 (size of the scene's main text; 1 = the template's own, long text still shrinks to fit),
      "voiceId": optional, only when the user asks for this scene in another voice of the same language }
  ]
}

# Rules (the plan is rejected if it breaks one)
- Every scene's template exists in the catalog, and its content has exactly that template's fields, within their limits.
- Each scene's estDuration is within its template's duration range.
- The estDurations add up to within ±15% of the requested length (aim for the requested length).
- The first scene uses a hook template. The last scene is logo_reveal or cta.
- The same template never appears twice in a row.
- Every sfx sound is one of the sounds listed below.
- Pacing: each voice speaks at its own rate (words per second, listed with the voices below); numbers count as the
  words they are read as ("41.8k" is 5 words, "$30" is 2), and each comma or period adds a ${PAUSE_SECONDS}s pause. A scene
  lasts its speaking time plus about ${overhead.toFixed(1)} s, never less than its template's minimum. Set estDuration to that
  (within 1 second), and keep each voiceover at least half a second under its template's maximum.

# Writing a good video
- Hook in the first scene: a sharp, specific line, not a greeting.
- One idea per scene. Short, concrete, benefit-first copy. On-screen text and voiceover work together; say the key
  on-screen words (headlines, feature card titles in order, the number of a stat) so the animation lands on them.
- Write numbers in the voiceover as digits (e.g. "10,000 teams") so counters start on the spoken number.
- Only use facts, numbers, quotes and claims that come from the brief or the website text. Never invent statistics,
  customers or testimonials. If there is no real number to show, don't use stat_counter.
- End with the ask (cta) and/or the brand (logo_reveal).
- Vary transitions to suit the mood. Sound effects are placed automatically (a whoosh on every cut, a pop per list item,
  an impact on the logo, a riser before the last scene); add sfx cues only for a specific moment, for example
  {"at": "on_word", "word": "free", "sound": "ding"}. "at" is "start", "end", "each_item" or "on_word" (which needs "word").
- Leave "sfx" as [] when the defaults are enough.

# Voices (voice.voiceId), by language
${LANGUAGES.filter((l) => l !== "hinglish")
  .map((l) => `${LANGUAGE_INFO[l].name}${l === "hi" ? " (and Hinglish)" : ""}:\n${voicesFor(l).map((v) => `- ${v.id}: ${v.label}, about ${voiceRate(v)} words per second${v.tier === "pro" ? " [Pro]" : ""}`).join("\n")}`)
  .join("\n")}
The voice must speak the video's language. For a new video pick a voice without [Pro]; use a [Pro] voice only when the
user asks for a different or premium voice. pr_ voices (Indic Parler) also take "style" in voice: ${VOICE_STYLES.map((s) => `"${s}"`).join(", ")}
(leave it out unless the user asks for a way of speaking).

# Transitions (transitionOut: how the scene leaves)
${Object.entries(TRANSITION_NOTES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

# Sounds (sfx[].sound)
${sounds.map((s) => `- ${s.id}: ${s.description}`).join("\n")}

# Icons
feature_grid icons are Tabler outline icon names. Common ones: ${commonIcons().join(", ")}.

${buildCatalog()}`;
}

function brandSection(b: Brief): string {
  if (b.brand) {
    return `Brand (fixed; copy it into the plan unchanged):\n${JSON.stringify({ name: b.brand.name, colors: b.brand.colors, font: b.brand.font }, null, 2)}`;
  }
  return "Brand: none given. Propose one that fits the brief: the product's name (from the brief), four colors with readable text on the background, and two Google Fonts.";
}

function researchSection(r: BrandResearch): string {
  const text = r.pageText.length > 5000 ? r.pageText.slice(0, 5000) + " …" : r.pageText;
  return [
    `Website (${r.url}), the only source of facts beyond the brief:`,
    r.description ? `Description: ${r.description}` : "",
    r.headings.length ? `Headings: ${r.headings.slice(0, 20).join(" | ")}` : "",
    `Page text: ${text}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// The images scenes can show, by name (device_mockup and screenshot_zoom).
export function imagesSection(assets: Record<string, Asset>): string {
  const names = Object.entries(assets);
  if (!names.length) return "Images: none, so don't use templates that need an image (device_mockup, screenshot_zoom).";
  return [
    'Images (use the name in a scene\'s "image" field):',
    ...names.map(([name, a]) => `- ${name}: ${a.description ?? "an image"}${a.regions && Object.keys(a.regions).length ? `; zoom regions: ${Object.keys(a.regions).join(", ")}` : ""}`),
  ].join("\n");
}

// The per-video request.
export function briefMessage(b: Brief): string {
  return [
    `Brief: ${b.prompt}`,
    `Length: ${b.durationSec} seconds. Format: ${b.format}. Mood: ${b.mood ?? "choose the best fit"}.`,
    `Language: ${languageNote(b.language ?? "en")}${(b.language ?? "en") !== "en" ? " Brand and product names stay as they are." : ""} Use one of these voices: ${voicesFor(b.language ?? "en", "free")
      .map((v) => v.id)
      .join(", ")}.`,
    brandSection(b),
    b.research ? researchSection(b.research) : "",
    imagesSection(b.research ? researchAssets(b.research) : {}),
    "Write the scene plan. Return it as one JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function fixMessage(b: Brief, previous: string, errors: string): string {
  return `${briefMessage(b)}

You wrote this plan:
${previous}

It was rejected for these reasons:
${errors}

Fix only these problems and keep everything else the same. Return the complete corrected plan as JSON.`;
}

export interface EditRequest {
  plan: Record<string, unknown>; // the current plan (without timing fields)
  instruction: string; // what the user typed, e.g. "make scene 2 text bigger"
  sceneId?: string; // the scene the user had selected
  research?: BrandResearch | null;
}

// A chat edit: the current plan plus the user's instruction; the answer is {summary, plan}.
export function editMessage(e: EditRequest): string {
  const scenes = Array.isArray(e.plan.scenes) ? (e.plan.scenes as { id?: string; template?: string }[]) : [];
  const index = e.sceneId ? scenes.findIndex((s) => s.id === e.sceneId) : -1;
  return [
    `This is the current scene plan of a video:\n${JSON.stringify(e.plan, null, 1)}`,
    index >= 0 ? `The user has scene ${index + 1} selected (id "${e.sceneId}", template ${scenes[index].template}).` : "",
    `The user asks: ${JSON.stringify(e.instruction)}`,
    e.research ? researchSection(e.research) : "",
    imagesSection((e.plan.assets as Record<string, Asset> | undefined) ?? {}),
    `Change the plan to do what the user asks, and nothing more: keep every other scene, field and word as it is.
- Change only the selected scene, unless the request is clearly about another scene or the whole video (music, voice,
  length, colors, order).
- Bigger or smaller text: set that scene's "textScale" (up to 1.4, down to 0.7). Long text shrinks to fit, so for a big
  jump also shorten it.
- Calmer or more upbeat music: music.mood (and the video's mood if it fits). Another voice: a different voiceId of the
  video's language from the list (set voice.engine to match); a way of speaking (calmer, more energetic): voice.style,
  which only pr_ voices have, so switch to a pr_ voice of the language if needed. One scene in another voice: that
  scene's "voiceId". Faster or slower speech: voice.speed (0.8 to 1.2), and re-check estDurations.
- A changed voiceover needs a matching estDuration (the pacing rule); keep the total within 15% of targetDuration
  (change targetDuration only when the user asks for another length: 15, 30, 60 or 90).
- If the request can't be done with the plan's fields, make the closest change and say so in the summary.
Return one JSON object: {"summary": "one short sentence telling the user what you changed", "plan": {the complete revised plan}}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function editFixMessage(e: EditRequest, previous: string, errors: string): string {
  return `${editMessage(e)}

You answered with this plan:
${previous}

It was rejected for these reasons:
${errors}

Fix only these problems. Return the same kind of JSON object: {"summary": "...", "plan": {...}}.`;
}
