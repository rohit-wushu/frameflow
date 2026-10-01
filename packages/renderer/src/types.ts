import type { ScenePlan } from "@frameflow/scene-schema";
import type { CaptionChunk, TimingResult } from "@frameflow/timing";

export type Quality = "draft" | "standard" | "high";

export interface RenderRequest {
  plan: ScenePlan; // timed plan (start/duration filled)
  timing: TimingResult;
  captions: CaptionChunk[];
  burnCaptions: boolean;
  mixFile: string; // final audio (.m4a); the video gets this exact file remuxed in
  logoFile: string | null; // local file
  images?: Record<string, string>; // plan.assets name -> local file, for the images scenes show
  workDir: string; // scratch space for this render
  output: string; // final .mp4
  quality: Quality;
  onProgress?: (message: string) => void;
}

export interface RenderResult {
  video: string;
  projectDir: string; // the composition that was rendered (useful for debugging)
  warnings: string[];
}

export interface SnapshotRequest extends Omit<RenderRequest, "output" | "quality"> {
  times: number[];
  outDir: string;
}

// Swappable: HyperFrames today, Remotion later.
export interface Renderer {
  readonly name: string;
  render(req: RenderRequest): Promise<RenderResult>;
  snapshot(req: SnapshotRequest): Promise<string[]>; // PNG stills at the given times
}
