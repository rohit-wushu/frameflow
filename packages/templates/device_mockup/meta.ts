import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "device_mockup",
  description:
    "A screenshot inside a browser window, laptop or phone frame. The device tilts up into view, then the screen slowly scrolls (tall images) or zooms. Optional title and subtitle beside it (landscape) or above it (portrait, square).",
  whenToUse:
    'Show the real product or website. Needs an image by name: the desktop screenshot in "browser" or "laptop", the phone screenshot in "phone" (best for 9:16). Say the title in the voiceover.',
  category: "content",
  minDuration: 3,
  maxDuration: 8,
  accentAt: 0.15,
  accentSound: "swoosh",
};
