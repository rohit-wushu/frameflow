import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "cta",
  description:
    "Call to action: a headline, an optional subline, a button that an animated cursor clicks on the accent (with a click sound), and an optional URL under it.",
  whenToUse: "The ask at the end: sign up, try it free, book a demo. Use it as the last scene, or right before logo_reveal.",
  category: "end",
  minDuration: 3,
  maxDuration: 6,
  accentAt: 1.8,
  accentSound: "click",
};
