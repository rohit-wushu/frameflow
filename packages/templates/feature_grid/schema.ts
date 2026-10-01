import { z } from "zod";
import { iconExists, suggestIcons } from "../icons.js";

export const schema = z.object({
  title: z.string().min(2).max(44).describe("the heading above the cards"),
  items: z
    .array(
      z.object({
        icon: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .superRefine((v, ctx) => {
            if (!iconExists(v)) ctx.addIssue({ code: "custom", message: `"${v}" is not a Tabler outline icon; close matches: ${suggestIcons(v).join(", ")}` });
          })
          .describe("Tabler outline icon name, e.g. microphone, sparkles, chart-bar"),
        title: z.string().min(2).max(24),
        text: z.string().min(2).max(64).optional(),
      }),
    )
    .min(2)
    .max(4),
});
