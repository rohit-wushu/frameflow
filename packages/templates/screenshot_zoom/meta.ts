import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "screenshot_zoom",
  description:
    "A full screenshot, then the camera zooms into one named area of it (e.g. the main button or the headline). The rest dims, a brand-color ring frames the area, and an optional callout label points at it.",
  whenToUse:
    'Point at one specific thing on the website or product. Needs an image by name and a focus: one of its zoom regions (listed with the image), or "center" / "top". The zoom happens about a second in, so mention the thing then.',
  category: "content",
  minDuration: 3.5,
  maxDuration: 8,
  accentAt: 1.2,
  accentSound: "swoosh",
};
