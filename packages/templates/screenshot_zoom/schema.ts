import { z } from "zod";

export const schema = z.object({
  image: z.string().min(1).describe("name of an available image, e.g. website"),
  focus: z.string().min(1).default("center").describe('a zoom region of the image (e.g. button, headline), or "center" / "top"'),
  title: z.string().min(2).max(40).optional().describe("short line above the screenshot"),
  callout: z.string().min(2).max(36).optional().describe("label pointing at the zoomed area"),
});
