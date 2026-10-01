import { normalizeWord, voiceWords } from "@frameflow/scene-schema";
import { z } from "zod";

export const schema = z
  .object({
    text: z
      .string()
      .min(3)
      .max(90)
      .refine((t) => voiceWords(t).length >= 2 && voiceWords(t).length <= 14, "use 2-14 words")
      .describe("the statement, said word for word in the voiceover"),
    emphasis: z.string().min(1).max(20).optional().describe("one word of the text to mark with the brand color"),
  })
  .refine((c) => !c.emphasis || voiceWords(c.text).includes(normalizeWord(c.emphasis)), {
    message: "emphasis must be one word of the text",
    path: ["emphasis"],
  });
