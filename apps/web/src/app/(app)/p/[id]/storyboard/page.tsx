import { db, effectiveTier } from "@frameflow/db";
import type { ScenePlan } from "@frameflow/scene-schema";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RetryDirector } from "@/components/retry-director";
import { Storyboard, type EditablePlan } from "@/components/storyboard/storyboard";
import { Waiting } from "@/components/waiting";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ownProject } from "@/lib/data";

export const metadata = { title: "Storyboard" };

export default async function StoryboardPage({ params }: PageProps<"/p/[id]/storyboard">) {
  const { id } = await params;
  const { user, project } = await ownProject(id);
  if (project.status === "researching" || project.status === "brand") redirect(`/p/${id}/brand`);
  if (project.status === "directing") {
    return <Waiting projectId={id} status={project.status} title="Writing the script…" hint="The director picks a template for every scene and writes the words. Usually under a minute." />;
  }
  if (!project.plan) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">The storyboard could not be written</h1>
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-wrap">{project.error ?? "Unknown error"}</AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <RetryDirector projectId={id} />
          <Button variant="ghost" asChild>
            <Link href={`/p/${id}/brand`}>Back to the brand</Link>
          </Button>
        </div>
      </div>
    );
  }
  const plan = project.plan as unknown as ScenePlan;
  const messages = await db().chatMessage.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" }, take: 200 });
  const initial: EditablePlan = { title: plan.title, mood: plan.mood, voice: plan.voice, music: plan.music, scenes: plan.scenes, targetDuration: plan.targetDuration, assets: plan.assets ?? {} };
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Step 3 of 5</p>
          <h1 className="text-3xl font-semibold tracking-tight">Storyboard</h1>
          <p className="text-muted-foreground">One card per scene. Edit the words, reorder, add or delete scenes, or ask for a change in the chat.</p>
        </div>
        {project.currentVersion && (
          <Button variant="ghost" asChild>
            <Link href={`/p/${id}`}>Back to the video</Link>
          </Button>
        )}
      </div>
      {project.error && (
        <Alert variant="destructive">
          <AlertDescription>{project.error}</AlertDescription>
        </Alert>
      )}
      <Storyboard
        key={project.updatedAt.toISOString()}
        projectId={id}
        initial={initial}
        format={project.format}
        language={project.language}
        rendered={!!project.currentVersion}
        isPro={effectiveTier(user) === "pro"}
        messages={messages.map((m) => ({ id: m.id, role: m.role, text: m.text, version: m.version, sceneId: m.sceneId, createdAt: m.createdAt.toISOString() }))}
      />
    </div>
  );
}
