// Render stages: one BullMQ job per pipeline stage (see packages/jobs). Progress goes to the Job table.
import { db, type Prisma } from "@frameflow/db";
import { addEvent, markFailed, RENDER_STAGES, type StageJobData } from "@frameflow/jobs";
import { loadResult, runStage, type Context, type RenderStage, type StageContext } from "@frameflow/pipeline";
import type { Job } from "bullmq";

const AUDIO_STAGES = new Set<RenderStage>(["voiceover", "alignment", "music"]);

export function stageProcessor(ctx: Context, ensureAudio: () => Promise<void>) {
  return async (job: Job<StageJobData>) => {
    const d = job.data;
    const stage = job.name as RenderStage;
    const index = RENDER_STAGES.indexOf(stage);
    await addEvent(d.jobId, { step: stage, status: "start" }, { status: "running", step: stage, detail: job.attemptsMade ? `retrying (attempt ${job.attemptsMade + 1})` : null });
    if (AUDIO_STAGES.has(stage)) await ensureAudio();
    const c: StageContext = {
      storage: ctx.storage,
      audio: ctx.audio,
      renderer: ctx.renderer,
      assetsDir: ctx.assetsDir,
      outKey: d.outKey,
      planDir: ctx.storage.root, // uploaded and researched logos are storage keys
      options: d.options,
      onEvent: (e) => {
        if (e.status === "info" || e.status === "warn") void addEvent(d.jobId, e, e.status === "info" ? { detail: e.message } : {}).catch(() => {});
      },
    };
    const t = Date.now();
    await runStage(stage, c, stage === "validate" ? { plan: d.plan } : undefined);
    await addEvent(d.jobId, { step: stage, status: "done", ms: Date.now() - t }, { stepsDone: index + 1, detail: null });
    if (stage === "finish") await completeRender(ctx, d);
  };
}

async function completeRender(ctx: Context, d: StageJobData) {
  const r = await loadResult(ctx.storage, d.outKey);
  const prisma = db();
  await prisma.$transaction([
    prisma.version.update({
      where: { projectId_number: { projectId: d.projectId, number: d.version } },
      data: { status: "ready", duration: r.timing.duration, qa: r.qa as unknown as Prisma.InputJsonValue, formats: Object.keys(r.qa.videos) },
    }),
    prisma.project.update({ where: { id: d.projectId }, data: { status: "ready", currentVersion: d.version, error: null } }),
    prisma.job.update({ where: { id: d.jobId }, data: { status: "done", step: "finish", stepsDone: RENDER_STAGES.length } }),
  ]);
}

// Called when a stage has used up its attempts (and again for each later stage the failure cancels).
export async function failRender(d: StageJobData, stage: string, err: Error) {
  const message = `${stage}: ${err.message}`;
  if (!(await markFailed(d.jobId, message))) return;
  const prisma = db();
  await prisma.version.update({ where: { projectId_number: { projectId: d.projectId, number: d.version } }, data: { status: "failed", error: message.slice(0, 4000) } });
  const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { currentVersion: true } });
  await prisma.project.update({
    where: { id: d.projectId },
    data: { status: project?.currentVersion ? "ready" : "storyboard", error: `Version ${d.version} failed while ${stageLabel(stage)}: ${err.message.split("\n")[0]}` },
  });
}

const LABELS: Record<string, string> = {
  validate: "checking the plan",
  voiceover: "making the voice",
  alignment: "timing the words",
  music: "picking music",
  timing: "cutting on the beat",
  sfx: "placing sound effects",
  mix: "mixing audio",
  captions: "writing captions",
  render: "rendering",
  finish: "running the final checks",
};
const stageLabel = (s: string) => LABELS[s] ?? s;
