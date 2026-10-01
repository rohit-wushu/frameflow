import { z } from "zod";

export const schema = z.object({
  title: z.string().min(2).max(44).optional().describe("a heading above both columns"),
  leftLabel: z.string().min(2).max(24).describe("the old way, e.g. 'Before' or 'Agencies'"),
  left: z.array(z.string().min(2).max(36)).min(2).max(4).describe("its downsides, 2-5 words each"),
  rightLabel: z.string().min(2).max(24).describe("the better way, e.g. 'With Frameflow'"),
  right: z.array(z.string().min(2).max(36)).min(2).max(4).describe("its upsides, 2-5 words each, said in the voiceover"),
});
