// The render stages as the user sees them, with a rough share of the total time (for the progress bar).
export const RENDER_STEPS = [
  { id: "validate", label: "Checking the plan", weight: 1 },
  { id: "voiceover", label: "Making voice", weight: 8 },
  { id: "alignment", label: "Timing the words", weight: 6 },
  { id: "music", label: "Picking music", weight: 2 },
  { id: "timing", label: "Cutting on the beat", weight: 1 },
  { id: "sfx", label: "Placing sound effects", weight: 1 },
  { id: "mix", label: "Mixing audio", weight: 6 },
  { id: "captions", label: "Writing captions", weight: 1 },
  { id: "render", label: "Rendering", weight: 60 },
  { id: "finish", label: "Final checks", weight: 14 },
] as const;

// 0..1 overall, counting the render step's own percentage when it reports one.
export function renderProgress(stepsDone: number, detail: string | null): number {
  const total = RENDER_STEPS.reduce((s, x) => s + x.weight, 0);
  let done = RENDER_STEPS.slice(0, stepsDone).reduce((s, x) => s + x.weight, 0);
  const current = RENDER_STEPS[stepsDone];
  const pct = detail ? /(\d+(?:\.\d+)?)%/.exec(detail) : null;
  if (current && pct) done += current.weight * Math.min(1, Number(pct[1]) / 100);
  return Math.min(1, done / total);
}
