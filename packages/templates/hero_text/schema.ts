import { normalizeWord, voiceWords } from "@frameflow/scene-schema";
import { z } from "zod";

export const schema = z
  .object({
    eyebrow: z.string().min(1).max(28).optional().describe("small label above the headline, e.g. the brand or a category"),
    headline: z.string().min(3).max(60).describe("the big line, 2-8 words"),
    highlight: z.string().min(1).max(20).optional().describe("one word of the headline to color with the brand color"),
    subtext: z.string().min(1).max(110).optional().describe("one supporting sentence"),
  })
  .refine((c) => !c.highlight || voiceWords(c.headline).includes(normalizeWord(c.highlight)), {
    message: "highlight must be one word of the headline",
    path: ["highlight"],
  });
