import { z } from "zod";

export const schema = z.object({
  title: z.string().min(2).max(48).describe("the heading, e.g. 'Making videos today'"),
  items: z.array(z.string().min(2).max(42)).min(2).max(4).describe("the pain points, 2-6 words each"),
  style: z.enum(["cross", "stack"]).default("cross").describe('"cross" strikes them out at the end; "stack" piles them up'),
});
