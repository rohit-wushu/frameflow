// Brand research, the director (first plan) and chat edits.
import { relative } from "node:path";
import { db, type Prisma } from "@frameflow/db";
import { researchBrand, revisePlan, writePlan, type Attempt, type BrandResearch, type Language, type Llm, type Sound } from "@frameflow/director";
import { addEvent, enqueueRender, markFailed, untimed, type ChatJobData, type DirectJobData, type ResearchJobData } from "@frameflow/jobs";
import { loadMusicLibrary, loadSfxLibrary, type Context } from "@frameflow/pipeline";
import type { Brand, Format, Mood, ScenePlan } from "@frameflow/scene-schema";
import { UnrecoverableError, type Job } from "bullmq";

const json = (x: unknown) => x as Prisma.InputJsonValue;

// What we keep of a website read (Project.research). Files are storage keys.
export interface StoredResearch extends Omit<BrandResearch, "screenshot"> {
  screenshot: string;
}

function toBrief(r: StoredResearch | null): BrandResearch | null {
  return r ? { ...r, screenshot: r.screenshot } : null;
}

async function directorOptions(ctx: Context, llm: Llm, onAttempt: (a: Attempt) => void) {
  const [sfx, tracks] = await Promise.all([loadSfxLibrary(ctx.assetsDir), loadMusicLibrary(ctx.assetsDir)]);
  const sounds: Sound[] = sfx.map((s) => ({ id: s.id, description: s.description ?? s.id }));
  return { llm, sounds, musicMoods: [...new Set(tracks.flatMap((t) => t.moods))], onAttempt };
}

// Rate limits, overloads and network errors are worth another try; a plan the director can't fix is not.
function classify(e: unknown): Error {
  const message = (e as Error).message ?? String(e);
  return /rate limit|overloaded|API error 5\d\d|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(message) ? (e as Error) : new UnrecoverableError(message);
}

const attemptNote = (a: Attempt) =>
  `${a.errors.length ? `attempt ${a.n}: ${a.errors.length} problem(s) sent back to fix` : `attempt ${a.n}: plan accepted`} (${(a.ms / 1000).toFixed(0)} s)`;

export function researchProcessor(ctx: Context) {
  return async (job: Job<ResearchJobData>) => {
    const { jobId, projectId, url } = job.data;
    await addEvent(jobId, { step: "brand", status: "start" }, { status: "running", step: "brand" });
    const r = await researchBrand(url, ctx.storage.path(`research/${projectId}`));
    const key = (file: string) => relative(ctx.storage.root, file);
    const brand: Brand = { ...r.brand, logoUrl: r.brand.logoUrl ? key(r.brand.logoUrl) : undefined };
    if (!brand.logoUrl) delete brand.logoUrl;
    const shots = r.screenshots;
    const stored: StoredResearch = {
      ...r,
      brand,
      screenshot: key(r.screenshot),
      screenshots: shots && {
        desktop: { ...shots.desktop, file: key(shots.desktop.file) },
        ...(shots.mobile ? { mobile: { ...shots.mobile, file: key(shots.mobile.file) } } : {}),
      },
    };
    await db().project.update({ where: { id: projectId }, data: { research: json(stored), brand: json(brand), status: "brand", error: null } });
    await addEvent(jobId, { step: "brand", status: "done" }, { status: "done", stepsDone: 1 });
  };
}

export async function failResearch(d: ResearchJobData, err: Error) {
  if (!(await markFailed(d.jobId, err.message))) return;
  await db().project.update({
    where: { id: d.projectId },
    data: { status: "brand", error: `Couldn't read ${d.url}: ${err.message.split("\n")[0]}. Fill in the brand yourself, or let the director pick one.` },
  });
}

export function directProcessor(ctx: Context, llm: (email: string) => Llm) {
  return async (job: Job<DirectJobData>) => {
    const { jobId, projectId } = job.data;
    const prisma = db();
    const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { user: { select: { email: true } } } });
    await addEvent(jobId, { step: "director", status: "start" }, { status: "running", step: "director" });
    const research = p.research as StoredResearch | null;
    try {
      const opts = await directorOptions(ctx, llm(p.user.email), (a) => void addEvent(jobId, { step: "director", status: "info", message: attemptNote(a) }, { detail: attemptNote(a) }).catch(() => {}));
      const brief = { prompt: p.prompt, durationSec: p.durationSec, format: p.format as Format, mood: (p.mood as Mood | null) ?? undefined, language: p.language as Language, voiceId: p.voiceId ?? undefined, brand: p.brand as Brand | null, research: toBrief(research) };
      const { plan, attempts } = await writePlan(brief, { ...opts, id: p.id });
      await ctx.storage.writeJson(`projects/${p.id}/director-${Date.now().toString(36)}.json`, { prompt: p.prompt, url: p.url, attempts });
      // an uploaded logo stays when the director proposed the colors and fonts
      if (!p.brand && p.logoKey) plan.brand = { ...plan.brand, logoUrl: p.logoKey };
      await prisma.project.update({
        where: { id: projectId },
        data: { plan: json(untimed(plan)), title: plan.title, brand: json(p.brand ?? plan.brand), status: "storyboard", error: null },
      });
      await addEvent(jobId, { step: "director", status: "done" }, { status: "done", stepsDone: 1 });
    } catch (e) {
      throw classify(e);
    }
  };
}

export async function failDirect(d: DirectJobData, err: Error) {
  if (!(await markFailed(d.jobId, err.message))) return;
  await db().project.update({ where: { id: d.projectId }, data: { status: "failed", error: `The director couldn't write the storyboard: ${err.message}` } });
}

export function chatProcessor(ctx: Context, llm: (email: string) => Llm) {
  return async (job: Job<ChatJobData>) => {
    const d = job.data;
    const prisma = db();
    const p = await prisma.project.findUniqueOrThrow({ where: { id: d.projectId }, include: { user: { select: { email: true } } } });
    if (!p.plan) throw new UnrecoverableError("this project has no storyboard yet");
    await addEvent(d.jobId, { step: "director", status: "start" }, { status: "running", step: "director" });
    try {
      const opts = await directorOptions(ctx, llm(p.user.email), (a) => void addEvent(d.jobId, { step: "director", status: "info", message: attemptNote(a) }).catch(() => {}));
      const current = untimed(p.plan as unknown as ScenePlan);
      const { plan, summary } = await revisePlan({ plan: current, instruction: d.instruction, sceneId: d.sceneId ?? undefined, research: toBrief(p.research as StoredResearch | null) }, opts);
      if (d.render) {
        const { version } = await enqueueRender({
          projectId: p.id,
          userId: d.userId,
          plan,
          note: `chat: ${d.instruction}`.slice(0, 200),
          formats: p.extraFormats as Format[],
          burnCaptions: p.captions,
        });
        await prisma.chatMessage.create({ data: { projectId: p.id, role: "assistant", text: `${summary} Rendering it as version ${version}.`, version } });
      } else {
        await prisma.project.update({ where: { id: p.id }, data: { plan: json(untimed(plan)), title: plan.title } });
        await prisma.chatMessage.create({ data: { projectId: p.id, role: "assistant", text: summary } });
      }
      await addEvent(d.jobId, { step: "director", status: "done" }, { status: "done", stepsDone: 1 });
    } catch (e) {
      throw classify(e);
    }
  };
}

export async function failChat(d: ChatJobData, err: Error) {
  if (!(await markFailed(d.jobId, err.message))) return;
  await db().chatMessage.create({ data: { projectId: d.projectId, role: "assistant", text: `I couldn't make that change: ${err.message.split("\n").slice(0, 4).join(" ")}` } });
}
