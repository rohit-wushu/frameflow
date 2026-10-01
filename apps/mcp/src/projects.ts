// Projects on disk: storage/projects/<id>/v<version>/ (plan.json, video.mp4, qa.json, ...).
// Every edit is a new version, so earlier versions stay available for undo.
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Storage } from "@frameflow/pipeline";
import type { ScenePlan } from "@frameflow/scene-schema";

export interface ProjectInfo {
  id: string;
  title: string;
  versions: number[];
  latest: number;
  updated: string;
  hasVideo: boolean;
}

async function versionsOf(storage: Storage, id: string): Promise<number[]> {
  const dir = storage.path(`projects/${id}`);
  if (!existsSync(dir) || !(await stat(dir)).isDirectory()) return [];
  const entries = await readdir(dir);
  return entries.map((e) => /^v(\d+)$/.exec(e)?.[1]).filter((v): v is string => !!v).map(Number).sort((a, b) => a - b);
}

export async function readPlan(storage: Storage, id: string, version?: number): Promise<{ plan: ScenePlan; version: number } | null> {
  const versions = await versionsOf(storage, id);
  const v = version ?? versions[versions.length - 1];
  if (v === undefined || !storage.exists(`projects/${id}/v${v}/plan.json`)) return null;
  return { plan: await storage.readJson<ScenePlan>(`projects/${id}/v${v}/plan.json`), version: v };
}

export async function nextVersion(storage: Storage, id: string): Promise<number> {
  const versions = await versionsOf(storage, id);
  return (versions[versions.length - 1] ?? 0) + 1;
}

export async function listProjects(storage: Storage, limit = 20): Promise<ProjectInfo[]> {
  const root = storage.path("projects");
  if (!existsSync(root)) return [];
  const out: ProjectInfo[] = [];
  for (const id of await readdir(root)) {
    const versions = await versionsOf(storage, id);
    if (!versions.length) continue;
    const latest = versions[versions.length - 1];
    const planPath = join(root, id, `v${latest}`, "plan.json");
    if (!existsSync(planPath)) continue;
    const plan = JSON.parse(await readFile(planPath, "utf8")) as ScenePlan;
    out.push({
      id,
      title: plan.title,
      versions,
      latest,
      updated: (await stat(planPath)).mtime.toISOString(),
      hasVideo: existsSync(join(root, id, `v${latest}`, "video.mp4")),
    });
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, limit);
}
