import { db } from "@frameflow/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ago, dateTime, Section, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Video" };

type Event = { at: string; step: string; status: string; message?: string; ms?: number };

export default async function AdminProject({ params }: PageProps<"/admin/projects/[id]">) {
  await requireAdmin(); // every page checks: the layout alone is skipped on client navigation
  const { id } = await params;
  const prisma = db();
  const project = await prisma.project.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, name: true } } } });
  if (!project) notFound();
  const [versions, jobs, messages] = await Promise.all([
    prisma.version.findMany({ where: { projectId: id }, orderBy: { number: "desc" }, select: { number: true, status: true, note: true, duration: true, formats: true, error: true, createdAt: true } }),
    prisma.job.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.chatMessage.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" }, take: 100 }),
  ]);
  const latest = versions.find((v) => v.status === "ready");

  return (
    <>
      <Link href="/admin/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Videos
      </Link>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          by{" "}
          <Link href={`/admin/users/${project.user.id}`} className="hover:underline">
            {project.user.name} ({project.user.email})
          </Link>{" "}
          · {project.format} · {project.durationSec}s · {project.language} · created {dateTime(project.createdAt)} · <span className="font-mono text-xs">{project.id}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3 rounded-xl border bg-card p-5 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Prompt</div>
            <p className="mt-1 whitespace-pre-wrap">{project.prompt}</p>
          </div>
          {project.url && (
            <div>
              <div className="text-xs text-muted-foreground">Website</div>
              <p className="mt-1 break-all">{project.url}</p>
            </div>
          )}
          {project.error && (
            <div>
              <div className="text-xs text-muted-foreground">Error</div>
              <p className="mt-1 whitespace-pre-wrap text-destructive">{project.error}</p>
            </div>
          )}
        </div>
        {latest ? (
          <div className="space-y-2">
            <video controls preload="metadata" src={`/api/files/projects/${project.id}/v${latest.number}/video.mp4`} className="w-full rounded-xl border bg-black" />
            <p className="text-xs text-muted-foreground">
              Version {latest.number} · {latest.note}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No finished video yet.</div>
        )}
      </div>

      <Section title="Versions">
        <Table head={["#", "Status", "Note", "Length", "Formats", "Made", "Error"]} empty="Not rendered yet.">
          {versions.map((v) => (
            <tr key={v.number}>
              <td>{v.number}</td>
              <td>
                <Badge variant={v.status === "failed" ? "destructive" : v.status === "ready" ? "default" : "outline"}>{v.status}</Badge>
              </td>
              <td>{v.note}</td>
              <td>{v.duration ? `${v.duration.toFixed(1)}s` : "—"}</td>
              <td className="text-muted-foreground">{v.formats.join(", ")}</td>
              <td className="whitespace-nowrap text-muted-foreground">{ago(v.createdAt)}</td>
              <td className="max-w-sm truncate text-xs text-destructive" title={v.error ?? ""}>
                {v.error ?? ""}
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Jobs">
        <div className="space-y-3">
          {!jobs.length && <p className="text-sm text-muted-foreground">No jobs.</p>}
          {jobs.map((j) => {
            const events = (j.events as Event[] | null) ?? [];
            return (
              <details key={j.id} className="rounded-xl border bg-card px-4 py-3 text-sm">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <Badge variant={j.status === "failed" ? "destructive" : j.status === "done" ? "secondary" : "outline"}>{j.status}</Badge>
                  <span className="font-medium">{j.kind}</span>
                  {j.version && <span className="text-muted-foreground">v{j.version}</span>}
                  <span className="text-muted-foreground">
                    {j.stepsDone}/{j.stepsTotal} steps · {dateTime(j.createdAt)} · took {Math.round((j.updatedAt.getTime() - j.createdAt.getTime()) / 1000)}s
                  </span>
                  {j.error && <span className="w-full truncate text-xs text-destructive">{j.error}</span>}
                </summary>
                <ol className="mt-3 space-y-1 font-mono text-xs text-muted-foreground">
                  {events.slice(-80).map((e, i) => (
                    <li key={i} className={e.status === "failed" ? "text-destructive" : undefined}>
                      {e.at.slice(11, 19)} {e.step} {e.status}
                      {e.ms ? ` ${(e.ms / 1000).toFixed(1)}s` : ""}
                      {e.message ? ` · ${e.message}` : ""}
                    </li>
                  ))}
                </ol>
              </details>
            );
          })}
        </div>
      </Section>

      {messages.length > 0 && (
        <Section title="Chat edits">
          <div className="space-y-2 text-sm">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-foreground" : "text-muted-foreground"}>
                <span className="text-xs uppercase">{m.role}</span> {m.text}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
