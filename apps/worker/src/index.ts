// The Frameflow worker: runs the background jobs the web app queues (see packages/jobs).
//   media queue: brand research + render stages (Chrome and the audio models; MEDIA_CONCURRENCY, default 1)
//   ai queue:    the director's plans and chat edits (Claude; AI_CONCURRENCY, default 3)
import { anthropicLlm, checkPlan, type Llm } from "@frameflow/director";
import { AI_QUEUE, CHECK_QUEUE, closeJobs, MEDIA_QUEUE, PREFIX, redis, RENDER_STAGES as JOB_STAGES, VOICE_QUEUE, type ChatJobData, type CheckJobData, type DirectJobData, type ResearchJobData, type StageJobData, type VoiceSampleJobData } from "@frameflow/jobs";
import { createContext, ensureAudioService, loadSfxLibrary, RENDER_STAGES, voiceSampleFile } from "@frameflow/pipeline";
import { Worker, type Job } from "bullmq";
import { chatProcessor, directProcessor, failChat, failDirect, failResearch, researchProcessor } from "./ai.js";
import { fakeDirector } from "./fake-director.js";
import { failRender, stageProcessor } from "./render.js";

if (JOB_STAGES.join() !== RENDER_STAGES.join()) throw new Error("packages/jobs RENDER_STAGES is out of sync with @frameflow/pipeline");

const ctx = createContext();
const log = (m: string) => console.log(`[worker ${new Date().toISOString().slice(11, 19)}] ${m}`);

// The audio service is (re)started on demand: checked before every audio stage, so a crashed or
// restarted service doesn't take the worker down with it.
let stopAudio: (() => void) | null = null;
let starting: Promise<void> | null = null;
const ensureAudio = async () => {
  if (starting) return starting;
  if (await ctx.audio.health()) return;
  starting = ensureAudioService(ctx.audio, ctx.root, ctx.storage.path("audio-service.log"), log)
    .then((stop) => {
      stopAudio = stop;
    })
    .finally(() => {
      starting = null;
    });
  return starting;
};

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
// The fake director (DIRECTOR_FAKE=1) only ever answers test accounts (…@frameflow.local): a fake-mode worker
// shares the queue with real users, and a real user once got a fake plan from one.
const TEST_ACCOUNT = /@frameflow\.local$/i;
const llm = (email: string): Llm => {
  if (process.env.DIRECTOR_FAKE === "1" && TEST_ACCOUNT.test(email)) return fakeDirector();
  return anthropicLlm({ model: process.env.DIRECTOR_MODEL || "claude-opus-5-5", effort: (process.env.DIRECTOR_EFFORT || "medium") as Effort });
};
if (process.env.DIRECTOR_FAKE === "1") log("DIRECTOR_FAKE=1: test accounts (@frameflow.local) get the fake director; everyone else gets Claude.");

const render = stageProcessor(ctx, ensureAudio);
const research = researchProcessor(ctx);
const media = new Worker(
  MEDIA_QUEUE,
  async (job: Job) => (job.name === "research" ? research(job as Job<ResearchJobData>) : render(job as Job<StageJobData>)),
  { connection: redis(), prefix: PREFIX, concurrency: Number(process.env.MEDIA_CONCURRENCY ?? 1), lockDuration: 60_000 },
);

const direct = directProcessor(ctx, llm);
const chat = chatProcessor(ctx, llm);
const ai = new Worker(AI_QUEUE, async (job: Job) => (job.name === "chat" ? chat(job as Job<ChatJobData>) : direct(job as Job<DirectJobData>)), {
  connection: redis(),
  prefix: PREFIX,
  concurrency: Number(process.env.AI_CONCURRENCY ?? 3),
  lockDuration: 120_000,
});

// the web app's plan checks: quick, many at once
const sfxIds = loadSfxLibrary(ctx.assetsDir).then((s) => s.map((x) => x.id));
const check = new Worker(CHECK_QUEUE, async (job: Job<CheckJobData>) => checkPlan(job.data.plan, { sfxIds: await sfxIds, brandFixed: job.data.brandFixed }), {
  connection: redis(),
  prefix: PREFIX,
  concurrency: 8,
});
check.on("error", (err) => log(`check worker error: ${err.message}`));

// voice previews for the voice picker (cached, so each voice + style is made once)
const voice = new Worker(
  VOICE_QUEUE,
  async (job: Job<VoiceSampleJobData>) => {
    await ensureAudio();
    return voiceSampleFile(ctx, job.data);
  },
  { connection: redis(), prefix: PREFIX, concurrency: 1, lockDuration: 120_000 },
);
voice.on("error", (err) => log(`voice worker error: ${err.message}`));

// a job is failed for good when its attempts are used up (or it threw an UnrecoverableError)
const finalFailure = (job: Job) => job.attemptsMade >= (job.opts.attempts ?? 1) || job.failedReason?.startsWith("Unrecoverable") || job.stacktrace?.some((s) => s.includes("UnrecoverableError"));

for (const w of [media, ai]) {
  w.on("active", (job) => log(`${job.name} ${job.data.projectId ?? ""} started`));
  w.on("completed", (job) => log(`${job.name} ${job.data.projectId ?? ""} done`));
  w.on("failed", (job, err) => {
    if (!job) return;
    log(`${job.name} ${job.data.projectId ?? ""} failed (attempt ${job.attemptsMade}): ${err.message.split("\n")[0]}`);
    const final = finalFailure(job) || err.name === "UnrecoverableError";
    if (!final) return;
    const done = (p: Promise<unknown>) => void p.catch((e) => log(`could not record the failure: ${(e as Error).message}`));
    if (job.name === "research") done(failResearch(job.data as ResearchJobData, err));
    else if (job.name === "direct") done(failDirect(job.data as DirectJobData, err));
    else if (job.name === "chat") done(failChat(job.data as ChatJobData, err));
    else done(failRender(job.data as StageJobData, job.name, err));
  });
  w.on("error", (err) => log(`worker error: ${err.message}`));
}

log(`listening on ${MEDIA_QUEUE}, ${AI_QUEUE}, ${CHECK_QUEUE} and ${VOICE_QUEUE} (Redis ${new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379/5").host})`);

const shutdown = async () => {
  log("shutting down (finishing running jobs)...");
  await Promise.all([media.close(), ai.close(), check.close(), voice.close()]);
  await closeJobs();
  stopAudio?.();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
