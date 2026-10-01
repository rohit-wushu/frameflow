"use client";
import { useRefreshOnStatus } from "@/hooks/use-project-state";

// A calm "working on it" panel that follows the job's latest messages and refreshes when done.
export function Waiting({ projectId, status, title, hint }: { projectId: string; status: string; title: string; hint?: string }) {
  const state = useRefreshOnStatus(projectId, status, true);
  const notes = (state?.job?.events ?? []).filter((e) => e.message).slice(-4);
  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center">
      <div className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint && <p className="text-muted-foreground">{hint}</p>}
      </div>
      <ul className="min-h-16 space-y-1 text-sm text-muted-foreground">
        {notes.map((e) => (
          <li key={e.at + e.message}>{e.message}</li>
        ))}
      </ul>
    </div>
  );
}
