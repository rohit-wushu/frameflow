// Background jobs (BullMQ on Redis). The web app enqueues, the worker (apps/worker) runs them.
// A render is a BullMQ flow with one job per pipeline stage (validate -> voiceover -> ... -> finish), so
// each stage reports its own progress and a failed stage is retried on its own. The Job table mirrors
// every job for the UI (live steps) and for quotas.
import { db, type Prisma } from "@frameflow/db";
import type { Format, ScenePlan } from "@frameflow/scene-schema";
import { FlowProducer, Queue, QueueEvents, type FlowJob, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

export const PREFIX = "frameflow";
export const MEDIA_QUEUE = "media"; // research + render stages: heavy (Chrome, audio models), one at a time by default
export const AI_QUEUE = "ai"; // director calls: light, several at once
export const CHECK_QUEUE = "check"; // plan validation for the web app (the worker owns the engine's rules)
export const VOICE_QUEUE = "voice"; // voice previews: one at a time, apart from renders so a preview doesn't wait for one

// Must match RENDER_STAGES in @frameflow/pipeline (the worker checks this at startup).
export const RENDER_STAGES = ["validate", "voiceover", "alignment", "music", "timing", "sfx", "mix", "captions", "render", "finish"] as const;
export type RenderStage = (typeof RENDER_STAGES)[number];

export interface RenderJobOptions {
  quality: "draft" | "high";
  burnCaptions: boolean;
  social: boolean;
  formats: Format[];
}
export interface StageJobData {
  jobId: string; // row in the Job table
  projectId: string;
  userId: string;
  version: number;
  outKey: string;
  options: RenderJobOptions;
  plan?: unknown; // only the validate stage gets the plan
}
export interface ResearchJobData {
  jobId: string;
  projectId: string;
  url: string;
}
export interface DirectJobData {
  jobId: string;
  projectId: string;
}
export interface ChatJobData {
  jobId: string;
  projectId: string;
  userId: string;
  instruction: string;
  sceneId: string | null;
  render: boolean; // editor: render the change as a new version; storyboard: only update the plan
}

const g = globalThis as unknown as { frameflowRedis?: Redis; frameflowQueues?: Record<string, Queue>; frameflowFlow?: FlowProducer; frameflowCheckEvents?: QueueEvents; frameflowVoiceEvents?: QueueEvents };

// One Redis connection per process (BullMQ duplicates it for blocking commands).
export function redis(): Redis {
  g.frameflowRedis ??= new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379/5", { maxRetriesPerRequest: null });
  return g.frameflowRedis;
}

export function queue(name: typeof MEDIA_QUEUE | typeof AI_QUEUE | typeof CHECK_QUEUE | typeof VOICE_QUEUE): Queue {
  g.frameflowQueues ??= {};
  g.frameflowQueues[name] ??= new Queue(name, { connection: redis(), prefix: PREFIX });
  return g.frameflowQueues[name];
}

function flow(): FlowProducer {
  g.frameflowFlow ??= new FlowProducer({ connection: redis(), prefix: PREFIX });
  return g.frameflowFlow;
}

const KEEP: JobsOptions = { removeOnComplete: { age: 24 * 3600 }, removeOnFail: { age: 7 * 24 * 3600 } };
const json = (x: unknown) => x as Prisma.InputJsonValue;

// Plans are stored without timing fields; the timing stage fills them per render.
export function untimed<T extends { scenes: object[] }>(plan: T): T {
  return { ...plan, scenes: plan.scenes.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== "start" && k !== "duration"))) };
}

// A new version of a project, rendered by the stage flow.
export async function enqueueRender(p: {
  projectId: string;
  userId: string;
  plan: ScenePlan;
  note: string;
  formats: Format[]; // extra formats besides the plan's own
  quality?: "draft" | "high";
  burnCaptions?: boolean;
}): Promise<{ version: number; jobId: string }> {
  const prisma = db();
  const { version, jobId, plan } = await prisma.$transaction(async (tx) => {
    const last = await tx.version.findFirst({ where: { projectId: p.projectId }, orderBy: { number: "desc" }, select: { number: true } });
    const version = (last?.number ?? 0) + 1;
    const plan = { ...untimed(p.plan), id: p.projectId, version };
    const formats = [plan.format, ...p.formats.filter((f) => f !== plan.format)];
    await tx.version.create({ data: { projectId: p.projectId, number: version, plan: json(plan), note: p.note, status: "rendering", formats } });
    const job = await tx.job.create({ data: { projectId: p.projectId, userId: p.userId, kind: "render", version, stepsTotal: RENDER_STAGES.length } });
    await tx.project.update({ where: { id: p.projectId }, data: { status: "rendering", error: null, plan: json(plan) } });
    return { version, jobId: job.id, plan };
  });

  const data: Omit<StageJobData, "plan"> = {
    jobId,
    projectId: p.projectId,
    userId: p.userId,
    version,
    outKey: `projects/${p.projectId}/v${version}`,
    options: { quality: p.quality ?? "high", burnCaptions: !!p.burnCaptions, social: true, formats: p.formats },
  };
  // the last stage is the root of the flow; each stage's child is the stage before it
  let node: FlowJob | undefined;
  for (const stage of RENDER_STAGES) {
    const opts: JobsOptions = { ...KEEP, attempts: stage === "validate" ? 1 : 2, backoff: { type: "fixed", delay: 3000 }, failParentOnFailure: true };
    node = { name: stage, queueName: MEDIA_QUEUE, data: stage === "validate" ? { ...data, plan } : data, opts, children: node ? [node] : undefined };
  }
  try {
    await flow().add(node!);
  } catch (e) {
    await markFailed(jobId, `could not queue the render: ${(e as Error).message}`);
    throw e;
  }
  return { version, jobId };
}

export async function enqueueResearch(p: { projectId: string; userId: string; url: string }): Promise<string> {
  const job = await db().job.create({ data: { projectId: p.projectId, userId: p.userId, kind: "research", stepsTotal: 1 } });
  const data: ResearchJobData = { jobId: job.id, projectId: p.projectId, url: p.url };
  await queue(MEDIA_QUEUE).add("research", data, { ...KEEP, attempts: 1 });
  return job.id;
}

export async function enqueueDirect(p: { projectId: string; userId: string }): Promise<string> {
  const prisma = db();
  const job = await prisma.job.create({ data: { projectId: p.projectId, userId: p.userId, kind: "direct", stepsTotal: 1 } });
  await prisma.project.update({ where: { id: p.projectId }, data: { status: "directing", error: null } });
  const data: DirectJobData = { jobId: job.id, projectId: p.projectId };
  await queue(AI_QUEUE).add("direct", data, { ...KEEP, attempts: 2, backoff: { type: "exponential", delay: 10_000 } });
  return job.id;
}

export async function enqueueChat(p: { projectId: string; userId: string; instruction: string; sceneId: string | null; render: boolean }): Promise<string> {
  const prisma = db();
  await prisma.chatMessage.create({ data: { projectId: p.projectId, role: "user", text: p.instruction, sceneId: p.sceneId } });
  const job = await prisma.job.create({ data: { projectId: p.projectId, userId: p.userId, kind: "chat", stepsTotal: 1 } });
  const data: ChatJobData = { jobId: job.id, projectId: p.projectId, userId: p.userId, instruction: p.instruction, sceneId: p.sceneId, render: p.render };
  await queue(AI_QUEUE).add("chat", data, { ...KEEP, attempts: 2, backoff: { type: "exponential", delay: 10_000 } });
  return job.id;
}

export interface CheckJobData {
  plan: unknown;
  brandFixed: boolean;
}
export type CheckResult = { ok: true; plan: ScenePlan } | { ok: false; errors: { path: string; message: string }[] };

// Validates a plan with the director's full rules (schema, templates, pacing, voices, fonts) in the worker.
export async function checkPlanInWorker(plan: unknown, brandFixed: boolean, timeoutMs = 20_000): Promise<CheckResult> {
  g.frameflowCheckEvents ??= new QueueEvents(CHECK_QUEUE, { connection: redis().duplicate(), prefix: PREFIX });
  const job = await queue(CHECK_QUEUE).add("check", { plan, brandFixed } satisfies CheckJobData, { removeOnComplete: { age: 60 }, removeOnFail: { age: 3600 } });
  try {
    return (await job.waitUntilFinished(g.frameflowCheckEvents, timeoutMs)) as CheckResult;
  } catch (e) {
    throw new Error(`the plan could not be checked (is the worker running? \`pnpm worker\`): ${(e as Error).message}`);
  }
}

export interface VoiceSampleJobData {
  voiceId: string;
  style: string | null;
  language: string;
}

// A short preview of a voice (cached in storage by the worker). Returns the wav's storage key.
export async function voiceSample(data: VoiceSampleJobData, timeoutMs = 90_000): Promise<string> {
  g.frameflowVoiceEvents ??= new QueueEvents(VOICE_QUEUE, { connection: redis().duplicate(), prefix: PREFIX });
  const job = await queue(VOICE_QUEUE).add("sample", data, { removeOnComplete: { age: 60 }, removeOnFail: { age: 3600 } });
  return (await job.waitUntilFinished(g.frameflowVoiceEvents, timeoutMs)) as string;
}

// Job table updates (used by the worker).
export interface JobEvent {
  at: string;
  step: string;
  status: "start" | "done" | "info" | "warn";
  message?: string;
  ms?: number;
}

export async function addEvent(jobId: string, e: Omit<JobEvent, "at">, set: Prisma.JobUpdateInput = {}) {
  const event = JSON.stringify([{ ...e, at: new Date().toISOString() }]);
  const prisma = db();
  // append atomically, keeping the last 300 events
  await prisma.$executeRaw`UPDATE "Job" SET events = (CASE WHEN jsonb_array_length(events) >= 300 THEN events - 0 ELSE events END) || ${event}::jsonb WHERE id = ${jobId}`;
  if (Object.keys(set).length) await prisma.job.update({ where: { id: jobId }, data: set });
}

export async function markFailed(jobId: string, error: string): Promise<boolean> {
  // only the first failure counts (a failed stage also fails every later stage of the flow)
  const r = await db().job.updateMany({ where: { id: jobId, status: { not: "failed" } }, data: { status: "failed", error: error.slice(0, 4000) } });
  return r.count > 0;
}

export async function closeJobs() {
  await Promise.all(Object.values(g.frameflowQueues ?? {}).map((q) => q.close()));
  await g.frameflowFlow?.close();
  await g.frameflowCheckEvents?.close();
  await g.frameflowVoiceEvents?.close();
  g.frameflowCheckEvents = undefined;
  g.frameflowVoiceEvents = undefined;
  g.frameflowRedis?.disconnect();
  g.frameflowQueues = undefined;
  g.frameflowFlow = undefined;
  g.frameflowRedis = undefined;
}
