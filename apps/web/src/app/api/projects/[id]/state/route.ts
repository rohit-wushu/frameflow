import { db } from "@frameflow/db";
import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";

// What the screens poll while something is working: status, the latest job's steps, versions, chat.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]/state">) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const prisma = db();
  const project = user ? await prisma.project.findFirst({ where: { id, userId: user.id }, select: { status: true, error: true, title: true, currentVersion: true, updatedAt: true } }) : null;
  if (!project) return Response.json({ error: "not found" }, { status: 404 });
  const [job, versions, messages, chatBusy] = await Promise.all([
    prisma.job.findFirst({ where: { projectId: id }, orderBy: { createdAt: "desc" } }),
    prisma.version.findMany({ where: { projectId: id }, orderBy: { number: "desc" }, select: { number: true, status: true, note: true, duration: true, formats: true, error: true, createdAt: true } }),
    prisma.chatMessage.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" }, take: 200, select: { id: true, role: true, text: true, version: true, sceneId: true, createdAt: true } }),
    prisma.job.count({ where: { projectId: id, kind: "chat", status: { in: ["queued", "running"] } } }),
  ]);
  const events = (job?.events as { at: string; step: string; status: string; message?: string; ms?: number }[] | undefined) ?? [];
  return Response.json(
    {
      ...project,
      job: job && { id: job.id, kind: job.kind, status: job.status, step: job.step, stepsDone: job.stepsDone, stepsTotal: job.stepsTotal, detail: job.detail, error: job.error, version: job.version, events: events.slice(-60) },
      versions,
      messages,
      chatBusy: chatBusy > 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
