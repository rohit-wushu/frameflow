import { z } from "zod";

export const schema = z.object({
  headline: z.string().min(2).max(40).describe("the ask, e.g. 'Make your first video'"),
  subline: z.string().min(2).max(80).optional(),
  buttonText: z.string().min(2).max(22),
  url: z.string().min(3).max(40).optional().describe("shown under the button, e.g. example.com/start"),
});
