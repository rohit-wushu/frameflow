import { z } from "zod";

export const schema = z.object({
  image: z.string().min(1).describe("name of an available image, e.g. website or website-mobile"),
  device: z.enum(["browser", "laptop", "phone"]).default("browser").describe("the frame around the screenshot"),
  title: z.string().min(2).max(40).optional().describe("short line next to the device"),
  subtitle: z.string().min(2).max(80).optional(),
});
