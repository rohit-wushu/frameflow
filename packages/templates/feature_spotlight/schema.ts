import { z } from "zod";
import { iconExists, suggestIcons } from "../icons.js";

export const schema = z.object({
  eyebrow: z.string().min(1).max(28).optional().describe("small label above the title, e.g. 'New'"),
  title: z.string().min(2).max(44).describe("the feature, 2-6 words"),
  text: z.string().min(2).max(120).describe("one sentence on what it does for the viewer"),
  icon: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .superRefine((v, ctx) => {
      if (!iconExists(v)) ctx.addIssue({ code: "custom", message: `"${v}" is not a Tabler outline icon; close matches: ${suggestIcons(v).join(", ")}` });
    })
    .optional()
    .describe("Tabler outline icon, shown when there is no image"),
  image: z.string().min(1).optional().describe("name of an available image (e.g. website); replaces the icon"),
});
