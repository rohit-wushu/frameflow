import type { TemplateMeta } from "../types.js";

export const meta: TemplateMeta = {
  name: "stat_counter",
  description:
    "One big number that counts up like an odometer, with an optional prefix/suffix in the brand color, a label under it and an optional small context line. The count starts when the narrator says the number.",
  whenToUse:
    "A single strong metric (users, hours saved, growth). Write the number in digits in the voiceover (e.g. '10,000 teams') so the count starts on it.",
  category: "content",
  minDuration: 2.5,
  maxDuration: 6,
};
