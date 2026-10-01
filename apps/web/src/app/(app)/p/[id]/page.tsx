import { readFile } from "node:fs/promises";
import { db } from "@frameflow/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteProject } from "@/components/delete-project";
import { Editor } from "@/components/editor/editor";
import type { TimelineScene } from "@/components/editor/timeline";
import { Button } from "@/components/ui/button";
import { ownProject, projectHref } from "@/lib/data";
import { readStorageJson, storagePath } from "@/lib/storage";

export default async function EditorPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const { project } = await ownProject(id);
  if (!project.currentVersion) redirect(projectHref(project));
  const prisma = db();
  const [current, versions, messages, renderingVersion] = await Promise.all([
    prisma.version.findFirstOrThrow({ where: { projectId: id, number: project.currentVersion } }),
    prisma.version.findMany({ where: { projectId: id }, orderBy: { number: "desc" } }),
    prisma.chatMessage.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.version.findFirst({ where: { projectId: id, status: "rendering" }, orderBy: { number: "desc" }, select: { number: true } }),
  ]);
  const key = `projects/${id}/v${current.number}`;
  const timing = await readStorageJson<{ duration: number; scenes: { id: string; start: number; duration: number }[] }>(`${key}/timing.json`);
  const wave = await readStorageJson<{ peaks: number[] }>(`${key}/waveform.json`);
  const credits = await readFile(storagePath(`${key}/credits.txt`), "utf8").catch(() => "");
  const qa = (current.qa ?? {}) as { checks?: { name: string; ok: boolean; detail: string }[]; warnings?: string[]; reused?: string[] };
  const plan = current.plan as { scenes: { id: string; template: string }[] };
  const scenes: TimelineScene[] = (timing?.scenes ?? []).map((s) => ({ ...s, template: plan.scenes.find((x) => x.id === s.id)?.template ?? "" }));
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Step 5 of 5</p>
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/p/${id}/storyboard`}>Edit storyboard</Link>
          </Button>
          <DeleteProject projectId={id} />
        </div>
      </div>
      <Editor
        projectId={id}
        title={project.title}
        format={project.format}
        status={project.status}
        version={{
          number: current.number,
          duration: current.duration ?? timing?.duration ?? 0,
          formats: current.formats,
          checks: qa.checks ?? [],
          warnings: qa.warnings ?? [],
          reused: qa.reused ?? [],
          note: current.note,
        }}
        scenes={scenes}
        peaks={wave?.peaks ?? []}
        credits={credits}
        versions={versions.map((v) => ({ number: v.number, status: v.status, note: v.note, duration: v.duration, formats: v.formats, error: v.error, createdAt: v.createdAt.toISOString() }))}
        messages={messages.map((m) => ({ id: m.id, role: m.role, text: m.text, version: m.version, sceneId: m.sceneId, createdAt: m.createdAt.toISOString() }))}
        renderingVersion={renderingVersion?.number ?? null}
      />
    </div>
  );
}
