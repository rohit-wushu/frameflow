import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "feature_spotlight",
  description:
    "One feature, up close: a big title, one short line, and a visual. The visual is an image (a screenshot, by name) or a large Tabler icon in a glowing circle that draws itself. Landscape puts the visual on the right; portrait and square stack it on top.",
  whenToUse:
    "Give one important feature its own moment. Say the title in the voiceover. Use an image when one shows the feature, otherwise an icon.",
  category: "content",
  minDuration: 3,
  maxDuration: 7,
  accentAt: 0.15,
  accentSound: "swoosh",
};
