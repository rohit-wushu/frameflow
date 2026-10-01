import { z } from "zod";

export const schema = z.object({
  tagline: z.string().min(2).max(56).optional().describe("short line under the logo"),
});
