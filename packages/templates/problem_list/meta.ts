import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "problem_list",
  description:
    'A title and 2-4 pain points. Each point slides in when the narrator names it. Style "cross": once all are shown, a brand-color line strikes through each one and they fade back, as if solved. Style "stack": the points land as tilted cards piling up.',
  whenToUse:
    "Name the problem before the solution (2-4 short pain points). Say each point (or its first word) in the voiceover, in order. Use \"cross\" when the next scene is the fix.",
  category: "content",
  minDuration: 3,
  maxDuration: 8,
  listField: "items",
};
