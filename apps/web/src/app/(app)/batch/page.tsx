import { db, Prisma } from "@frameflow/db";
import Link from "next/link";
import { BatchForm } from "@/components/batch-form";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { projectHref } from "@/lib/data";

export const metadata = { title: "Batch" };

export default async function BatchPage() {
  const user = await requireUser();
  const prisma = db();
  const [sources, batches] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id, batchId: null, plan: { not: Prisma.DbNull } }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, format: true } }),
    prisma.batch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { projects: { select: { id: true, title: true, status: true, currentVersion: true }, orderBy: { id: "asc" } } },
    }),
  ]);
  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Batch</h1>
        <p className="max-w-2xl text-muted-foreground">
          Make many versions of one video from a spreadsheet. In a video&apos;s storyboard, write placeholders like {"{{name}}"} or {"{{city}}"} in any text or
          voiceover; then upload a CSV with a column for each placeholder. Each row becomes its own video.
        </p>
      </div>
      <BatchForm sources={sources} />
      {batches.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Recent batches</h2>
          {batches.map((b) => {
            const ready = b.projects.filter((p) => p.status === "ready").length;
            return (
              <div key={b.id} className="space-y-3 rounded-xl border bg-card p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {ready}/{b.rows} ready · {b.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {b.projects.map((p) => (
                    <Link key={p.id} href={projectHref(p)} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                      <span className="truncate">{p.title}</span>
                      <StatusBadge status={p.status} />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
