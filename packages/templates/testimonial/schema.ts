import { z } from "zod";

export const schema = z.object({
  quote: z.string().min(10).max(180).describe("the exact quote, without quotation marks"),
  name: z.string().min(2).max(40).describe("who said it (a real person from the source)"),
  role: z.string().min(2).max(60).optional().describe("their title and company, e.g. 'Head of Growth, Acme'"),
});
