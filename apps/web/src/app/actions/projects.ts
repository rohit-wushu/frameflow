"use server";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { db, Prisma, usageFor } from "@frameflow/db";
import { checkPlanInWorker, enqueueChat, enqueueDirect, enqueueRender, enqueueResearch, untimed } from "@frameflow/jobs";
import { BrandSchema, FORMATS, LANGUAGES, MOODS, type Brand, type Format, type ScenePlan } from "@frameflow/scene-schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
import { ownProject } from "@/lib/data";
import { allow } from "@/lib/rate-limit";
import { storagePath, writeStorage } from "@/lib/storage";

const json = (x: unknown) => x as Prisma.InputJsonValue;
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "video";
export type Issue = { path: string; message: string };
export type ActionResult = { ok: true } | { ok: false; error?: string; issues?: Issue[] };

// Quotas: renders per month, director calls per day (see packages/db/src/limits.ts).
async function quota(user: { id: string; tier: string }, need: { render?: boolean; ai?: boolean }): Promise<string | null> {
  const u = await usageFor(db(), user);
  if (need.render && u.renders >= u.rendersLimit) return `You have used all ${u.rendersLimit} renders for this month (resets ${u.resetsOn.toISOString().slice(0, 10)}).`;
  if (need.ai && u.aiCalls >= u.aiCallsLimit) return `You have used today's ${u.aiCallsLimit} AI requests; try again tomorrow.`;
  return null;
}

// ---------- 1. prompt screen ----------

const NewProjectSchema = z.object({
  prompt: z.string().trim().min(3, "Describe the video in a line or two").max(600, "Keep the prompt under 600 characters"),
  url: z
    .string()
    .trim()
    .transform((s) => (s && !/^https?:\/\//i.test(s) ? `https://${s}` : s))
    .pipe(z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Enter a website like example.com" })])),
  duration: z.coerce.number().refine((n) => [15, 30, 60, 90].includes(n), "Pick 15, 30, 60 or 90 seconds"),
  format: z.enum(FORMATS),
  mood: z.union([z.literal(""), z.enum(MOODS)]),
  captions: z.boolean(),
  language: z.enum(LANGUAGES),
  logoUpload: z.string().optional(),
  brandKit: z.string().optional(),
});

export type NewProjectState = { error?: string } | undefined;

export async function createProject(_: NewProjectState, form: FormData): Promise<NewProjectState> {
  const user = await requireUser();
  const parsed = NewProjectSchema.safeParse({
    prompt: form.get("prompt") ?? "",
    url: form.get("url") ?? "",
    duration: form.get("duration") ?? 30,
    format: form.get("format") ?? "16:9",
    mood: form.get("mood") === "auto" ? "" : (form.get("mood") ?? ""),
    captions: form.get("captions") === "on",
    language: form.get("language") ?? "en",
    logoUpload: (form.get("logoUpload") as string) || undefined,
    brandKit: (form.get("brandKit") as string) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const over = await quota(user, { ai: true });
  if (over) return { error: over };

  const prisma = db();
  const upload = d.logoUpload ? await prisma.upload.findFirst({ where: { id: d.logoUpload, userId: user.id } }) : null;
  const kit = d.brandKit ? await prisma.brandKit.findFirst({ where: { id: d.brandKit, userId: user.id } }) : null;
  let brand = (kit?.brand as Brand | undefined) ?? null;
  if (brand && upload) brand = { ...brand, logoUrl: upload.key };

  const id = `${slug(d.prompt)}-${Date.now().toString(36)}`;
  const research = !!d.url && !kit;
  await prisma.project.create({
    data: {
      id,
      userId: user.id,
      title: d.prompt.slice(0, 80),
      prompt: d.prompt,
      url: d.url || null,
      format: d.format,
      durationSec: d.duration,
      mood: d.mood || null,
      language: d.language,
      captions: d.captions,
      brand: brand ? json(brand) : undefined,
      logoKey: upload?.key ?? null,
      status: research ? "researching" : "brand",
    },
  });
  if (research) await enqueueResearch({ projectId: id, userId: user.id, url: d.url });
  redirect(`/p/${id}/brand`);
}

// ---------- 2. brand check ----------

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors must look like #1A2B3C");

export async function confirmBrand(projectId: string, input: { mode: "confirm" | "auto"; brand?: unknown; logoKey?: string | null; saveKit?: boolean }): Promise<ActionResult> {
  const { user, project } = await ownProject(projectId);
  if (project.status === "directing") redirect(`/p/${projectId}/storyboard`);
  const over = await quota(user, { ai: true });
  if (over) return { ok: false, error: over };
  const prisma = db();

  // the logo may be: the researched one, the project's upload, a saved kit's, or a new upload of this user
  const research = project.research as { brand?: Brand } | null;
  const kits = await prisma.brandKit.findMany({ where: { userId: user.id }, select: { brand: true } });
  const allowedLogos = new Set([research?.brand?.logoUrl, (project.brand as Brand | null)?.logoUrl, project.logoKey, ...kits.map((k) => (k.brand as Brand).logoUrl)].filter(Boolean) as string[]);
  let logoKey = input.logoKey ?? null;
  if (logoKey && !allowedLogos.has(logoKey)) {
    const upload = await prisma.upload.findFirst({ where: { key: logoKey, userId: user.id } });
    if (!upload) return { ok: false, error: "That logo is not available" };
  }

  if (input.mode === "auto") {
    // the director proposes colors and fonts; an uploaded logo is kept (logoKey)
    await prisma.project.update({ where: { id: projectId }, data: { brand: Prisma.DbNull, logoKey } });
  } else {
    const parsed = BrandSchema.extend({ colors: z.object({ primary: hex, secondary: hex, background: hex, text: hex }) }).safeParse(input.brand);
    if (!parsed.success) return { ok: false, error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
    const brand: Brand = { ...parsed.data, logoUrl: logoKey ?? undefined };
    if (!brand.logoUrl) delete brand.logoUrl;
    const detected = [research?.brand?.font.heading, research?.brand?.font.body, (project.brand as Brand | null)?.font.heading, (project.brand as Brand | null)?.font.body];
    for (const f of [brand.font.heading, brand.font.body]) {
      if (!catalog.fonts.includes(f) && !detected.includes(f)) return { ok: false, error: `"${f}" is not one of the available fonts` };
    }
    await prisma.project.update({ where: { id: projectId }, data: { brand: json(brand), logoKey } });
    if (input.saveKit) await prisma.brandKit.create({ data: { userId: user.id, name: brand.name, brand: json(brand) } });
  }
  await enqueueDirect({ projectId, userId: user.id });
  redirect(`/p/${projectId}/storyboard`);
}

export async function retryDirector(projectId: string): Promise<ActionResult> {
  const { user } = await ownProject(projectId);
  const over = await quota(user, { ai: true });
  if (over) return { ok: false, error: over };
  await enqueueDirect({ projectId, userId: user.id });
  revalidatePath(`/p/${projectId}/storyboard`);
  return { ok: true };
}

// ---------- 3. storyboard ----------

// The client edits title, mood, voice, music and scenes; everything else is pinned to the project.
function pinPlan(project: { id: string; format: string; durationSec: number; language: string; brand: unknown; plan: unknown }, edited: Record<string, unknown>) {
  const current = project.plan as ScenePlan;
  const scenes = Array.isArray(edited.scenes) ? edited.scenes : current.scenes;
  return {
    title: edited.title ?? current.title,
    mood: edited.mood ?? current.mood,
    voice: edited.voice ?? current.voice,
    music: { ...(edited.music && typeof edited.music === "object" ? edited.music : current.music), mode: "library" },
    scenes: scenes.map((s: Record<string, unknown>) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== "start" && k !== "duration"))),
    id: project.id,
    version: current.version ?? 1,
    format: project.format,
    targetDuration: project.durationSec,
    language: project.language,
    brand: current.brand ?? project.brand,
    assets: current.assets,
  };
}

async function checkEdited(projectId: string, edited: Record<string, unknown>) {
  const { user, project } = await ownProject(projectId);
  if (!project.plan) return { user, project, result: { ok: false as const, error: "There is no storyboard yet" } };
  const r = await checkPlanInWorker(pinPlan(project, edited), true);
  return { user, project, result: r.ok ? { ok: true as const, plan: r.plan } : { ok: false as const, issues: r.errors } };
}

export async function saveStoryboard(projectId: string, edited: Record<string, unknown>): Promise<ActionResult> {
  const { result } = await checkEdited(projectId, edited);
  if (!result.ok) return result;
  await db().project.update({ where: { id: projectId }, data: { plan: json(untimed(result.plan)), title: result.plan.title } });
  return { ok: true };
}

export async function renderStoryboard(projectId: string, edited: Record<string, unknown>): Promise<ActionResult> {
  const { user, project, result } = await checkEdited(projectId, edited);
  if (!result.ok) return result;
  if (project.status === "rendering") return { ok: false, error: "A render is already running" };
  const over = await quota(user, { render: true });
  if (over) return { ok: false, error: over };
  await enqueueRender({
    projectId,
    userId: user.id,
    plan: result.plan,
    note: project.currentVersion ? "storyboard edits" : "first cut",
    formats: project.extraFormats as Format[],
    burnCaptions: project.captions,
  });
  redirect(`/p/${projectId}/progress`);
}

// ---------- chat (storyboard and editor) ----------

export async function sendChat(projectId: string, input: { text: string; sceneId: string | null; render: boolean }): Promise<ActionResult> {
  const { user, project } = await ownProject(projectId);
  const text = input.text.trim();
  if (text.length < 2 || text.length > 500) return { ok: false, error: "Write the change in a sentence (up to 500 characters)" };
  if (!project.plan) return { ok: false, error: "There is no storyboard yet" };
  if (input.render && project.status === "rendering") return { ok: false, error: "Wait for the current render to finish" };
  const busy = await db().job.count({ where: { projectId, kind: "chat", status: { in: ["queued", "running"] } } });
  if (busy) return { ok: false, error: "The last change is still being made" };
  const over = await quota(user, { ai: true, render: input.render });
  if (over) return { ok: false, error: over };
  const scenes = (project.plan as ScenePlan).scenes;
  const sceneId = input.sceneId && scenes.some((s) => s.id === input.sceneId) ? input.sceneId : null;
  await enqueueChat({ projectId, userId: user.id, instruction: text, sceneId, render: input.render });
  return { ok: true };
}

// ---------- 5. editor ----------

// Undo: make an earlier version current again (no re-render; its video is already there).
export async function restoreVersion(projectId: string, number: number): Promise<ActionResult> {
  const { project } = await ownProject(projectId);
  if (project.status === "rendering") return { ok: false, error: "Wait for the current render to finish" };
  const version = await db().version.findFirst({ where: { projectId, number, status: "ready" } });
  if (!version) return { ok: false, error: `Version ${number} has no finished video` };
  await db().$transaction([
    db().project.update({ where: { id: projectId }, data: { currentVersion: number, plan: json(untimed(version.plan as unknown as ScenePlan)), status: "ready", error: null } }),
    db().chatMessage.create({ data: { projectId, role: "assistant", text: `Restored version ${number} (${version.note}).`, version: number } }),
  ]);
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}

// All formats from one plan: the same plan and audio, rendered again in the other formats.
export async function renderFormats(projectId: string, formats: string[]): Promise<ActionResult> {
  const { user, project } = await ownProject(projectId);
  const extra = FORMATS.filter((f) => formats.includes(f) && f !== project.format);
  if (!extra.length) return { ok: false, error: "Pick at least one other format" };
  if (project.status === "rendering") return { ok: false, error: "Wait for the current render to finish" };
  const over = await quota(user, { render: true });
  if (over) return { ok: false, error: over };
  const current = project.currentVersion ? await db().version.findFirst({ where: { projectId, number: project.currentVersion } }) : null;
  if (!current) return { ok: false, error: "Render the video first" };
  await db().project.update({ where: { id: projectId }, data: { extraFormats: extra } });
  await enqueueRender({ projectId, userId: user.id, plan: current.plan as unknown as ScenePlan, note: `added ${extra.join(" and ")}`, formats: extra, burnCaptions: project.captions });
  redirect(`/p/${projectId}/progress`);
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const { project } = await ownProject(projectId);
  if (project.status === "rendering" || project.status === "researching") return { ok: false, error: "Wait until it has finished working" };
  await db().project.delete({ where: { id: projectId } });
  await Promise.all([rm(storagePath(`projects/${projectId}`), { recursive: true, force: true }), rm(storagePath(`research/${projectId}`), { recursive: true, force: true })]);
  revalidatePath("/");
  return { ok: true };
}

// ---------- uploads and brand kits ----------

// Logo images only: PNG, JPEG, WebP or SVG (without scripts), up to 2 MB.
function sniff(bytes: Uint8Array): { ext: string; mime: string } | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { ext: "png", mime: "image/png" };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp" };
  const head = new TextDecoder().decode(bytes.slice(0, 2048)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return { ext: "svg", mime: "image/svg+xml" };
  return null;
}

export async function uploadLogo(form: FormData): Promise<{ ok: true; id: string; key: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an image" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "The logo must be under 2 MB" };
  if (!(await allow(`upload:${user.id}`, 30, 3600))) return { ok: false, error: "Too many uploads; try again in an hour" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return { ok: false, error: "Use a PNG, JPEG, WebP or SVG image" };
  if (type.ext === "svg" && /<script|javascript:|\son[a-z]+\s*=|<foreignobject/i.test(new TextDecoder().decode(bytes))) {
    return { ok: false, error: "This SVG contains scripts; export it again as a plain SVG or PNG" };
  }
  const id = randomBytes(12).toString("hex");
  const key = `uploads/${user.id}/${id}.${type.ext}`;
  await writeStorage(key, bytes);
  const upload = await db().upload.create({ data: { userId: user.id, key, mime: type.mime, size: bytes.length } });
  return { ok: true, id: upload.id, key };
}

export async function deleteBrandKit(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db().brandKit.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/brands");
  return { ok: true };
}
