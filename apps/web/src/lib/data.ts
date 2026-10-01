import "server-only";
import { db } from "@frameflow/db";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";

// Data access: every project read goes through the owner check.
export async function ownProject(id: string) {
  const user = await requireUser();
  const project = await db().project.findFirst({ where: { id, userId: user.id } });
  if (!project) notFound();
  return { user, project };
}

// Where a project should be shown, by its status.
export function projectHref(p: { id: string; status: string; currentVersion: number | null }): string {
  if (p.status === "researching" || p.status === "brand") return `/p/${p.id}/brand`;
  if (p.status === "directing" || p.status === "storyboard" || (p.status === "failed" && !p.currentVersion)) return `/p/${p.id}/storyboard`;
  if (p.status === "rendering") return `/p/${p.id}/progress`;
  return `/p/${p.id}`;
}
