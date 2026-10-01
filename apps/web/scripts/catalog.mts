// Writes src/generated/catalog.json: everything the web app needs to know about templates, voices,
// music moods and fonts, without importing the engine (which reads files at runtime) into Next.js.
// Runs before `next dev` / `next build`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_RATE, isGoogleFont, PAUSE_SECONDS, SPEECH, TRANSITION_NOTES, VOICES } from "@frameflow/director";
import { FORMATS, MOODS } from "@frameflow/scene-schema";
import { commonIcons, templates } from "@frameflow/templates";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

// Brand fonts the user can pick (all on Google Fonts; checked below).
const FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Nunito", "Work Sans", "DM Sans", "Manrope",
  "Space Grotesk", "Plus Jakarta Sans", "Outfit", "Sora", "Urbanist", "Lexend", "Figtree", "Rubik", "Karla", "Archivo",
  "Barlow", "IBM Plex Sans", "Source Sans 3", "Noto Sans", "Mulish", "Quicksand", "Josefin Sans", "Geist", "Instrument Sans",
  "Onest", "Bricolage Grotesque", "Syne", "Playfair Display", "Merriweather", "Lora", "DM Serif Display", "Fraunces",
  "Libre Baskerville", "Cormorant Garamond", "Bebas Neue", "Oswald", "Anton", "Archivo Black", "Space Mono", "JetBrains Mono",
];

const fonts: string[] = [];
for (const f of FONTS) if (await isGoogleFont(f)) fonts.push(f);
const missing = FONTS.filter((f) => !fonts.includes(f));
if (missing.length) console.warn(`not on Google Fonts, left out: ${missing.join(", ")}`);

const music = JSON.parse(readFileSync(join(root, "assets", "music", "music.json"), "utf8")) as { tracks: { moods: string[] }[] };
const catalog = {
  templates: Object.values(templates).map((t) => ({
    ...t.meta,
    schema: z.toJSONSchema(t.schema, { io: "input", unrepresentable: "any" }),
    example: t.example,
  })),
  voices: VOICES.map((v) => ({ id: v.id, lang: v.lang, label: v.label, rate: v.rate ?? DEFAULT_RATE })),
  speech: { defaultRate: DEFAULT_RATE, pause: PAUSE_SECONDS, overhead: SPEECH.overhead },
  transitions: TRANSITION_NOTES,
  formats: FORMATS,
  moods: MOODS,
  musicMoods: [...new Set(music.tracks.flatMap((t) => t.moods))],
  icons: commonIcons(),
  fonts,
};
const out = join(here, "..", "src", "generated", "catalog.json");
writeFileSync(out, JSON.stringify(catalog, null, 1) + "\n");
console.log(`wrote ${out}: ${catalog.templates.length} templates, ${catalog.voices.length} voices, ${fonts.length} fonts`);
