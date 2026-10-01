"use server";
import { db, usageFor, type Prisma } from "@frameflow/db";
import { checkPlanInWorker, enqueueRender, untimed } from "@frameflow/jobs";
import { batchPlans, findPlaceholders, parseCsv, type Format, type ScenePlan } from "@frameflow/scene-schema";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

const MAX_ROWS = 100;
const MAX_CSV = 200_000; // characters
const json = (x: unknown) => x as Prisma.InputJsonValue;

export type BatchPreview =
  | { ok: true; placeholders: string[]; headers: string[]; sample: Record<string, string>[]; rows: number }
  | { ok: false; error: string; placeholders?: string[] };

async function source(projectId: string) {
  const user = await requireUser();
  const project = await db().project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!project?.plan) return { user, project: null };
  return { user, project };
}

function rowsFor(plan: ScenePlan, csvText: string) {
  if (csvText.length > MAX_CSV) throw new Error(`the CSV is too large (max ${MAX_CSV / 1000} KB)`);
  return batchPlans(untimed(plan), parseCsv(csvText), MAX_ROWS);
}

// What a CSV would make, before anything is rendered.
export async function previewBatch(projectId: string, csvText: string): Promise<BatchPreview> {
  const { project } = await source(projectId);
  if (!project) return { ok: false, error: "Pick a video that has a storyboard" };
  const plan = project.plan as unknown as ScenePlan;
  const placeholders = findPlaceholders(untimed(plan));
  if (!csvText.trim()) return { ok: false, error: "", placeholders };
  try {
    const csv = parseCsv(csvText);
    const rows = rowsFor(plan, csvText);
    return { ok: true, placeholders, headers: csv.headers, sample: csv.rows.slice(0, 5), rows: rows.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message, placeholders };
  }
}

export type BatchResult = { ok: true; batchId: string; videos: number } | { ok: false; error: string; rowErrors?: { row: number; problems: string[] }[] };

// Every row is checked first (the filled text must still fit its templates); nothing renders unless all pass.
export async function createBatch(projectId: string, csvText: string): Promise<BatchResult> {
  const { user, project } = await source(projectId);
  if (!project) return { ok: false, error: "Pick a video that has a storyboard" };
  let rows;
  try {
    rows = rowsFor(project.plan as unknown as ScenePlan, csvText);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!user.emailVerifiedAt) return { ok: false, error: "Confirm your email first: open the link we sent you." };
  const usage = await usageFor(db(), user);
  const left = usage.rendersLimit - usage.renders;
  if (rows.length > left) return { ok: false, error: `This batch needs ${rows.length} renders; you have ${left} left this month.` };

  const checked = await Promise.all(rows.map(async (r) => ({ r, check: await checkPlanInWorker({ ...(r.plan as object), id: "batch-check", version: 1 }, true, 30_000) })));
  const rowErrors = checked.filter((c) => !c.check.ok).map((c) => ({ row: c.r.row, problems: c.check.ok ? [] : c.check.errors.map((e) => `${e.path}: ${e.message}`) }));
  if (rowErrors.length) return { ok: false, error: `${rowErrors.length} of ${rows.length} rows don't fit the storyboard. Fix them and try again.`, rowErrors };

  const prisma = db();
  const batch = await prisma.batch.create({ data: { userId: user.id, sourceProjectId: project.id, name: project.title, rows: rows.length } });
  const tag = batch.id.slice(-5);
  for (const { r, check } of checked) {
    if (!check.ok) continue;
    const first = Object.values(r.values)[0] ?? String(r.row);
    const id = `${project.id.slice(0, 36)}-${tag}-${String(r.row).padStart(3, "0")}`;
    const plan = { ...check.plan, id };
    await prisma.project.create({
      data: {
        id,
        userId: user.id,
        batchId: batch.id,
        title: `${plan.title} · ${first}`.slice(0, 120),
        prompt: project.prompt,
        url: project.url,
        format: project.format,
        extraFormats: project.extraFormats,
        durationSec: project.durationSec,
        mood: project.mood,
        language: project.language,
        captions: project.captions,
        brand: project.brand ? json(project.brand) : undefined,
        logoKey: project.logoKey,
        plan: json(plan),
        status: "rendering",
      },
    });
    await enqueueRender({ projectId: id, userId: user.id, plan, note: `batch row ${r.row}`, formats: project.extraFormats as Format[], burnCaptions: project.captions });
  }
  revalidatePath("/batch");
  return { ok: true, batchId: batch.id, videos: rows.length };
}
