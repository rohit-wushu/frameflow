import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "comparison",
  description:
    "Two columns: the old way (left, muted, with crosses) and the better way (right, in the brand color, with checks). The left column appears first; each right-hand point lands when the narrator says it, and the right column lights up at the end. Portrait stacks the columns.",
  whenToUse:
    "Before vs after, or the usual way vs this product (2-4 points a side). The voiceover should mainly say the right-hand points, in order.",
  category: "content",
  minDuration: 4,
  maxDuration: 9,
  listField: "right",
};
