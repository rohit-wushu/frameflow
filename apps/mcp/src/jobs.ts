// Render jobs for the connector. A render takes 1-3 minutes, longer than a tool call should block,
// so create_video starts a job and get_video waits for it. One render at a time (8 GB machines).
import { randomUUID } from "node:crypto";
import { STEPS, type MakeVideoResult, type StepEvent } from "@frameflow/pipeline";

export interface Job {
  id: string;
  projectId: string;
  version: number;
  title: string;
  status: "queued" | "running" | "done" | "failed";
  step: string | null; // label of the step in progress
  detail: string | null; // latest info line (e.g. "rendering 50%")
  stepsDone: number;
  stepsTotal: number;
  warnings: string[];
  createdAt: number;
  finishedAt: number | null;
  result: MakeVideoResult | null;
  error: string | null;
}

const LABEL = Object.fromEntries(STEPS.map((s) => [s.id, s.label]));
const ENGINE_STEPS = STEPS.filter((s) => s.id !== "brand" && s.id !== "director").length;

export class JobQueue {
  private jobs = new Map<string, Job>();
  private chain: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(job: Job) => void>();

  start(meta: { projectId: string; version: number; title: string }, run: (onEvent: (e: StepEvent) => void) => Promise<MakeVideoResult>): Job {
    const job: Job = {
      id: `job-${randomUUID().slice(0, 8)}`,
      ...meta,
      status: "queued",
      step: null,
      detail: null,
      stepsDone: 0,
      stepsTotal: ENGINE_STEPS,
      warnings: [],
      createdAt: Date.now(),
      finishedAt: null,
      result: null,
      error: null,
    };
    this.jobs.set(job.id, job);
    this.chain = this.chain.then(async () => {
      job.status = "running";
      this.emit(job);
      try {
        job.result = await run((e) => {
          if (e.status === "start") job.step = LABEL[e.step] ?? e.step;
          if (e.status === "done") job.stepsDone++;
          if (e.status === "info") job.detail = e.message ?? null;
          if (e.status === "warn" && e.message) job.warnings.push(e.message);
          this.emit(job);
        });
        job.status = "done";
      } catch (e) {
        job.status = "failed";
        job.error = (e as Error).message;
      }
      job.finishedAt = Date.now();
      this.emit(job);
    });
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  // Resolve when the job finishes or after `ms`, calling onUpdate on every progress change meanwhile.
  async wait(id: string, ms: number, onUpdate?: (job: Job) => void): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job || job.status === "done" || job.status === "failed") return job;
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve();
      };
      const listener = (j: Job) => {
        if (j.id !== id) return;
        onUpdate?.(j);
        if (j.status === "done" || j.status === "failed") finish();
      };
      const timer = setTimeout(finish, ms);
      this.listeners.add(listener);
    });
    return job;
  }

  private emit(job: Job) {
    for (const l of this.listeners) l(job);
  }
}
