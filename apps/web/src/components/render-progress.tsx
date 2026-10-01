"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProjectState } from "@/hooks/use-project-state";
import { RENDER_STEPS, renderProgress } from "@/lib/steps";
import { cn } from "@/lib/utils";

export function RenderProgress({ projectId, version, compact = false, onDone }: { projectId: string; version: number; compact?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const state = useProjectState(projectId, true, 1000);
  const job = state?.job?.kind === "render" && state.job.version === version ? state.job : null;
  const failed = job?.status === "failed";
  const done = job?.status === "done";

  useEffect(() => {
    if (!done) return;
    if (onDone) onDone();
    else router.push(`/p/${projectId}`);
  }, [done, onDone, projectId, router]);

  const value = job ? (done ? 1 : renderProgress(job.stepsDone, job.detail)) : 0;
  const reused = (job?.events ?? []).filter((e) => e.message?.startsWith("reused")).map((e) => e.message!.slice("reused ".length));

  if (compact) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span>Rendering version {version}</span>
          <span className="text-muted-foreground">{job?.step ? RENDER_STEPS.find((s) => s.id === job.step)?.label : "Queued"}</span>
        </div>
        <Progress value={value * 100} />
        {failed && <p className="text-sm text-destructive">{job?.error}</p>}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-8 py-10">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Step 4 of 5</p>
        <h1 className="text-3xl font-semibold tracking-tight">{failed ? "The render stopped" : done ? "Done" : `Making version ${version}`}</h1>
        <p className="text-muted-foreground">{state?.title}</p>
      </div>
      <Progress value={value * 100} className="h-2" />
      <ol className="space-y-2.5">
        {RENDER_STEPS.map((s, i) => {
          const state = !job ? "waiting" : i < job.stepsDone ? "done" : i === job.stepsDone && !done ? (failed ? "failed" : "active") : "waiting";
          return (
            <li key={s.id} className={cn("flex items-center gap-3 text-sm", state === "waiting" && "text-muted-foreground/60")}>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px]",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "active" && "animate-pulse border-primary",
                  state === "failed" && "border-destructive bg-destructive text-white",
                )}
              >
                {state === "done" ? "✓" : state === "failed" ? "!" : ""}
              </span>
              <span>{s.label}</span>
              {state === "active" && job?.detail && <span className="text-xs text-muted-foreground">{job.detail}</span>}
            </li>
          );
        })}
      </ol>
      {!job && <p className="text-sm text-muted-foreground">Waiting for the worker to pick it up…</p>}
      {reused.length > 0 && <p className="text-sm text-muted-foreground">Already made, reused: {reused.join(", ")}.</p>}
      {failed && (
        <>
          <Alert variant="destructive">
            <AlertDescription className="whitespace-pre-wrap">{job?.error}</AlertDescription>
          </Alert>
          <Button asChild variant="secondary">
            <Link href={`/p/${projectId}/storyboard`}>Back to the storyboard</Link>
          </Button>
        </>
      )}
    </div>
  );
}
