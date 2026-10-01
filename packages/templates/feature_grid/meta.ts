import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "feature_grid",
  description:
    "A title and 2-4 feature cards, each with a Tabler icon, a short title and an optional line of text. Cards pop in one by one as the narrator names them, and their icons draw themselves.",
  whenToUse:
    "Show 2-4 features or benefits together. Say each card's title in the voiceover, in order, so every card lands on its word.",
  category: "content",
  minDuration: 3,
  maxDuration: 8,
  listField: "items",
};
