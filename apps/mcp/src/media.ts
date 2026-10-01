// Small images for tool results, so Claude can look at the website and at the finished video.
import { ffmpeg } from "@frameflow/mixer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function jpegThumbnail(file: string, width: number, at?: number): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "frameflow-"));
  const out = join(dir, "thumb.jpg");
  try {
    await ffmpeg([...(at !== undefined ? ["-ss", at.toFixed(2)] : []), "-i", file, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "4", out]);
    return (await readFile(out)).toString("base64");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
