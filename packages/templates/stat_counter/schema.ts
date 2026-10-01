import { z } from "zod";

export const schema = z.object({
  value: z.number().min(0).max(999_999_999).describe("the number to count up to"),
  decimals: z.number().int().min(0).max(2).default(0),
  prefix: z.string().min(1).max(3).optional().describe('shown before the number, e.g. "$" or "+"'),
  suffix: z.string().min(1).max(8).optional().describe('shown after the number, e.g. "%", "x", "k"'),
  label: z.string().min(2).max(56).describe("what the number means"),
  context: z.string().min(2).max(48).optional().describe("small print, e.g. a source or time frame"),
});
