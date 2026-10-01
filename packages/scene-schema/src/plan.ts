import { z } from "zod";
import { LANGUAGES } from "./languages";

// The scene plan is the contract for everything: the director writes it, every engine reads it.

export const FORMATS = ["16:9", "9:16", "1:1"] as const;
export const MOODS = ["energetic", "calm", "premium", "playful", "serious"] as const;
export const TRANSITIONS = ["cut", "fade", "slide", "zoom", "wipe"] as const;
export const SFX_ANCHORS = ["start", "end", "each_item", "on_word"] as const;
export const END_TEMPLATES = ["logo_reveal", "cta"] as const;
export const VOICE_ENGINES = ["kokoro", "indic-parler"] as const;
// How an Indic Parler voice speaks (Kokoro voices have one way of speaking each).
export const VOICE_STYLES = ["natural", "calm", "energetic", "cheerful", "serious", "warm"] as const;

// Indic Parler voice ids start with "pr_" (pr_<language>_<speaker>); everything else is Kokoro.
export const voiceEngine = (voiceId: string) => (voiceId.startsWith("pr_") ? "indic-parler" : "kokoro");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex color like #1A2B3C");

export const BrandSchema = z.object({
  name: z.string().min(1).max(60),
  colors: z.object({
    primary: hexColor,
    secondary: hexColor,
    background: hexColor,
    text: hexColor,
  }),
  font: z.object({
    heading: z.string().min(1).max(60), // Google Fonts family name
    body: z.string().min(1).max(60),
  }),
  logoUrl: z.string().min(1).optional(), // http(s) URL, or a path relative to the plan file
});

export const SfxCueSchema = z
  .object({
    at: z.enum(SFX_ANCHORS),
    word: z.string().min(1).optional(),
    sound: z.string().min(1),
  })
  .refine((c) => c.at !== "on_word" || !!c.word, { message: 'an "on_word" cue needs a "word"', path: ["word"] });

// A named area of an image, in percent of its width and height (e.g. a website's main button).
export const BoxSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().gt(0).max(100),
  h: z.number().gt(0).max(100),
});

// An image scenes can show (content.image refers to it by name). Files are resolved like logoUrl.
// The engine fills these in (website screenshots, uploads); the director only picks them by name.
export const AssetSchema = z.object({
  file: z.string().min(1),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  description: z.string().max(200).optional(),
  regions: z.record(z.string(), BoxSchema).optional(),
});

export const SceneSchema = z.object({
  id: z.string().min(1).max(40),
  template: z.string().min(1),
  content: z.record(z.string(), z.unknown()),
  voiceover: z.string().max(400), // "" = no voice in this scene
  estDuration: z.number().positive(),
  duration: z.number().positive().optional(), // filled by the timing step
  start: z.number().min(0).optional(), // filled by the timing step
  sfx: z.array(SfxCueSchema).default([]),
  transitionOut: z.enum(TRANSITIONS),
  textScale: z.number().min(0.7).max(1.4).optional(), // main text size (1 = the template's own); long text still shrinks to fit
  voiceId: z.string().min(1).optional(), // this scene in another voice than the plan's (a Pro customization)
});

export const ScenePlanSchema = z.object({
  id: z.string().min(1).max(80),
  version: z.number().int().min(1),
  title: z.string().min(1).max(120),
  format: z.enum(FORMATS),
  targetDuration: z.number().positive().max(180),
  language: z.enum(LANGUAGES),
  mood: z.enum(MOODS),
  brand: BrandSchema,
  voice: z
    .object({
      engine: z.enum(VOICE_ENGINES),
      voiceId: z.string().min(1),
      speed: z.number().min(0.5).max(2),
      style: z.enum(VOICE_STYLES).optional(), // Indic Parler voices only; default natural
    })
    .refine((v) => v.engine === voiceEngine(v.voiceId), { message: 'engine must match the voice: "indic-parler" for pr_ voices, otherwise "kokoro"', path: ["engine"] }),
  music: z.object({
    mode: z.enum(["library", "generate"]),
    mood: z.string().min(1),
    bpm: z.number().positive().optional(),
    trackId: z.string().optional(),
  }),
  scenes: z.array(SceneSchema).min(1),
  assets: z.record(z.string().regex(/^[a-z0-9-]+$/, "asset names are lowercase-with-dashes"), AssetSchema).optional(),
});

export type Brand = z.infer<typeof BrandSchema>;
export type Box = z.infer<typeof BoxSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type SfxCue = z.infer<typeof SfxCueSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type ScenePlan = z.infer<typeof ScenePlanSchema>;
export type Format = (typeof FORMATS)[number];
export type Mood = (typeof MOODS)[number];
export type Transition = (typeof TRANSITIONS)[number];
export type VoiceStyle = (typeof VOICE_STYLES)[number];
export type VoiceEngine = (typeof VOICE_ENGINES)[number];

export const FORMAT_SIZE: Record<Format, { width: number; height: number; resolution: string }> = {
  "16:9": { width: 1920, height: 1080, resolution: "landscape" },
  "9:16": { width: 1080, height: 1920, resolution: "portrait" },
  "1:1": { width: 1080, height: 1080, resolution: "square" },
};
