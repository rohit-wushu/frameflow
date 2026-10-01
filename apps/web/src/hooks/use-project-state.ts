"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface JobEvent {
  at: string;
  step: string;
  status: "start" | "done" | "info" | "warn";
  message?: string;
  ms?: number;
}
export interface ProjectState {
  status: string;
  error: string | null;
  title: string;
  currentVersion: number | null;
  job: { id: string; kind: string; status: string; step: string | null; stepsDone: number; stepsTotal: number; detail: string | null; error: string | null; version: number | null; events: JobEvent[] } | null;
  versions: { number: number; status: string; note: string; duration: number | null; formats: string[]; error: string | null; createdAt: string }[];
  messages: { id: string; role: string; text: string; version: number | null; sceneId: string | null; createdAt: string }[];
  chatBusy: boolean;
}

// Polls the project's state while `active`.
export function useProjectState(id: string, active: boolean, intervalMs = 1500): ProjectState | null {
  const [state, setState] = useState<ProjectState | null>(null);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/projects/${id}/state`, { cache: "no-store" });
        if (r.ok && !stopped) setState(await r.json());
      } catch {
        // offline for a moment; try again
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };
    timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, active, intervalMs]);
  return state;
}

// Re-renders the page (server data) when the project's status moves on.
export function useRefreshOnStatus(id: string, status: string, active: boolean) {
  const router = useRouter();
  const state = useProjectState(id, active);
  const seen = useRef(status);
  useEffect(() => {
    if (state && state.status !== seen.current) {
      seen.current = state.status;
      router.refresh();
    }
  }, [state, router]);
  return state;
}
