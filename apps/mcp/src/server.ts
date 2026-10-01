// Frameflow as an MCP connector: Claude is the director. It reads the guide, writes the scene plan,
// and these tools validate it, render it and edit it. Same engine as the CLI (packages/pipeline).
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { checkPlan, researchAssets, researchBrand, slug, SPEECH, systemPrompt } from "@frameflow/director";
import { formatIssues, FORMATS, type Format, type ScenePlan } from "@frameflow/scene-schema";
import { makeVideo, type Context, type MakeVideoResult } from "@frameflow/pipeline";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Job, JobQueue } from "./jobs.js";
import { jpegThumbnail } from "./media.js";
import { listProjects, nextVersion, readPlan } from "./projects.js";

export interface ServerDeps {
  ctx: Context;
  jobs: JobQueue;
  ensureAudio: () => Promise<void>; // starts the local audio service on first use
  fileUrl?: (absPath: string) => string | null; // public link to an output file (HTTP mode)
}

const WAIT_MS = 45_000; // how long a tool call waits for a render before returning progress

const INSTRUCTIONS = `Frameflow makes finished motion-graphics videos (voiceover, music on the beat, sound effects, animation)
from a scene plan. You are the director: call get_video_guide first, then (with a website) research_brand, write the
plan, check_plan until it is valid, create_video, and get_video until the video is ready. Show the user the video path
and the music credit. To change a video: get_project, then edit_scene (one scene) or revise_video (anything).`;

const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }], isError: true });

export function createServer(deps: ServerDeps): McpServer {
  const { ctx, jobs } = deps;
  const { storage } = ctx;
  const sounds = (JSON.parse(readFileSync(join(ctx.assetsDir, "sfx", "sfx.json"), "utf8")).sounds as { id: string; description: string }[]).map((s) => ({ id: s.id, description: s.description }));
  const musicMoods = [...new Set((JSON.parse(readFileSync(join(ctx.assetsDir, "music", "music.json"), "utf8")).tracks as { moods: string[] }[]).flatMap((t) => t.moods))];
  const sfxIds = sounds.map((s) => s.id);
  const show = (p: string) => {
    const url = deps.fileUrl?.(p);
    return url ? `${p}\n  link: ${url}` : p;
  };

  // plans come from Claude without id/version; the server owns those (and the timing fields)
  const prepare = (plan: Record<string, unknown>, id: string, version: number) => ({
    ...plan,
    id,
    version,
    scenes: Array.isArray(plan.scenes) ? plan.scenes.map((s) => (s && typeof s === "object" ? { ...s, start: undefined, duration: undefined } : s)) : plan.scenes,
  });

  const startRender = async (plan: ScenePlan, opts: { quality: "draft" | "high"; captions: boolean; formats?: Format[] }) => {
    await deps.ensureAudio();
    return jobs.start({ projectId: plan.id, version: plan.version, title: plan.title }, (onEvent) =>
      makeVideo({
        plan,
        planDir: storage.root,
        storage,
        audio: ctx.audio,
        renderer: ctx.renderer,
        assetsDir: ctx.assetsDir,
        quality: opts.quality,
        burnCaptions: opts.captions,
        social: true,
        formats: opts.formats,
        onEvent,
      }),
    );
  };

  const describe = async (job: Job): Promise<CallToolResult> => {
    if (job.status === "failed") return fail(`The render of "${job.title}" (${job.projectId} v${job.version}) failed:\n${job.error}`);
    if (job.status !== "done") {
      const where = job.status === "queued" ? "waiting for another render to finish" : `${job.step ?? "starting"}${job.detail ? ` (${job.detail})` : ""}`;
      return text(`Still working on "${job.title}": step ${Math.min(job.stepsDone + 1, job.stepsTotal)} of ${job.stepsTotal}, ${where}.\nCall get_video with job_id "${job.id}" again to keep waiting.`);
    }
    const r = job.result as MakeVideoResult;
    const credit = (await storage.read(relative(storage.root, join(r.outDir, "credits.txt")))).toString().trim();
    const lines = [
      `Video ready: "${job.title}" (project ${job.projectId}, version ${job.version}), ${r.timing.duration.toFixed(1)} s, ${r.plan.format}.`,
      `- video: ${show(r.video)}`,
      ...Object.entries(r.videos)
        .filter(([f]) => f !== r.plan.format)
        .map(([f, p]) => `- ${f} version: ${show(p as string)}`),
      r.social ? `- smaller social version: ${show(r.social)}` : "",
      `- folder with plan, captions (.srt/.vtt) and QA: ${r.outDir}`,
      "",
      "Checks:",
      ...r.qa.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`),
      r.qa.warnings.length ? `\nWarnings:\n${r.qa.warnings.map((w) => `- ${w}`).join("\n")}` : "",
      `\nCredits (the music credit must be shown with the video):\n${credit}`,
      `\nThe images below are one frame from the middle of each scene.`,
    ];
    // a frame from the middle of each scene, so the result can be checked by eye
    const frames = await Promise.all(r.timing.scenes.slice(0, 6).map((s) => jpegThumbnail(r.video, 480, s.start + s.duration * 0.6)));
    return {
      content: [{ type: "text", text: lines.filter((l) => l !== "").join("\n") }, ...frames.map((data) => ({ type: "image" as const, data, mimeType: "image/jpeg" }))],
    };
  };

  // Wait for a job, sending MCP progress notifications when the client asked for them.
  const waitAndDescribe = async (jobId: string, extra: { _meta?: { progressToken?: string | number }; sendNotification: (n: never) => Promise<void> }) => {
    const token = extra._meta?.progressToken;
    const job = await jobs.wait(jobId, WAIT_MS, (j) => {
      if (token === undefined) return;
      void extra
        .sendNotification({ method: "notifications/progress", params: { progressToken: token, progress: j.stepsDone, total: j.stepsTotal, message: j.step ?? undefined } } as never)
        .catch(() => {});
    });
    if (!job) return fail(`No job "${jobId}". Jobs only live while the Frameflow server runs; use get_project to find finished videos.`);
    return describe(job);
  };

  const server = new McpServer({ name: "frameflow", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "get_video_guide",
    {
      title: "How to direct a Frameflow video",
      description: "Call this first. Returns how to write a Frameflow scene plan: the plan format, the rules it must pass, the template catalog with every field and limit, voices, transitions, sounds and icons.",
      annotations: { readOnlyHint: true },
    },
    async () => text(systemPrompt(sounds, musicMoods, SPEECH.overhead, "tool")),
  );

  server.registerTool(
    "research_brand",
    {
      title: "Read a website's brand",
      description: "Opens a website and extracts the brand (name, logo, colors, Google Fonts), the page text, and screenshots (desktop with named zoom regions, and phone) for device_mockup / screenshot_zoom. Put the returned brand and assets objects into the plan unchanged, and use only facts from the page text. Also returns a screenshot.",
      inputSchema: { url: z.string().url().describe("the website, e.g. https://example.com") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ url }) => {
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        const r = await researchBrand(url, storage.path(`research/${slug(host)}-${Date.now().toString(36)}`));
        const body = {
          brand: r.brand,
          assets: researchAssets(r),
          notes: r.notes,
          description: r.description,
          headings: r.headings.slice(0, 20),
          pageText: r.pageText.length > 5000 ? r.pageText.slice(0, 5000) + " …" : r.pageText,
        };
        const shot = await jpegThumbnail(r.screenshot, 960);
        return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }, { type: "image", data: shot, mimeType: "image/jpeg" }] };
      } catch (e) {
        return fail(`Could not read ${url}: ${(e as Error).message}`);
      }
    },
  );

  const planArg = z.record(z.string(), z.unknown()).describe("the scene plan, as described by get_video_guide");

  server.registerTool(
    "check_plan",
    {
      title: "Check a scene plan",
      description: "Validates a scene plan without rendering it. Returns every problem at once (with paths like scenes[2].content.headline), or confirms it is valid.",
      inputSchema: { plan: planArg },
      annotations: { readOnlyHint: true },
    },
    async ({ plan }) => {
      const r = await checkPlan(prepare(plan, "check", 1), { sfxIds, brandFixed: false });
      if (!r.ok) return text(`The plan has ${r.errors.length} problem(s). Fix them and check again:\n${formatIssues(r.errors)}`);
      const est = r.plan.scenes.reduce((s, x) => s + x.estDuration, 0);
      return text(`The plan is valid: ${r.plan.scenes.length} scenes, about ${est.toFixed(0)} s. Call create_video with it.`);
    },
  );

  const renderArgs = {
    quality: z.enum(["draft", "high"]).default("high").describe("draft renders faster for a quick look"),
    captions: z.boolean().default(false).describe("burn word-by-word captions into the video"),
    formats: z.array(z.enum(FORMATS)).optional().describe("also render these formats from the same plan, e.g. [\"9:16\", \"1:1\"]"),
  };

  server.registerTool(
    "create_video",
    {
      title: "Create a video",
      description: "Validates the scene plan and renders the video (voice, music, sound effects, animation). Takes 1-3 minutes: returns when done or with a job_id to pass to get_video.",
      inputSchema: { plan: planArg, ...renderArgs },
    },
    async ({ plan, quality, captions, formats }, extra) => {
      const title = typeof plan.title === "string" ? plan.title : "video";
      const id = `${slug(title)}-${Date.now().toString(36)}`;
      const r = await checkPlan(prepare(plan, id, 1), { sfxIds, brandFixed: false });
      if (!r.ok) return fail(`The plan was not rendered. Fix these problems and call create_video again:\n${formatIssues(r.errors)}`);
      const job = await startRender(r.plan, { quality, captions, formats });
      return waitAndDescribe(job.id, extra);
    },
  );

  server.registerTool(
    "get_video",
    {
      title: "Wait for a video",
      description: "Waits up to 45 s for a render started by create_video, edit_scene or revise_video. Returns the video path, the quality checks and a frame from each scene when done; otherwise the progress.",
      inputSchema: { job_id: z.string().describe("the job_id from create_video, edit_scene or revise_video") },
      annotations: { readOnlyHint: true },
    },
    async ({ job_id }, extra) => waitAndDescribe(job_id, extra),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get a project",
      description: "Returns a project's current scene plan (latest version unless a version is given), its versions, and its video paths.",
      inputSchema: { project_id: z.string(), version: z.number().int().positive().optional().describe("an earlier version, e.g. to undo") },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, version }) => {
      const found = await readPlan(storage, project_id, version);
      if (!found) return fail(`No project "${project_id}"${version ? ` version ${version}` : ""}. Use list_projects to see what exists.`);
      const info = (await listProjects(storage, 1000)).find((p) => p.id === project_id);
      const video = storage.path(`projects/${project_id}/v${found.version}/video.mp4`);
      const plan = { ...found.plan, scenes: found.plan.scenes.map(({ start, duration, ...s }) => s) };
      return text(
        [
          `Project ${project_id}, version ${found.version} (versions: ${info?.versions.join(", ") ?? found.version}).`,
          storage.exists(`projects/${project_id}/v${found.version}/video.mp4`) ? `Video: ${show(video)}` : "No video for this version yet.",
          "Scene plan:",
          JSON.stringify(plan, null, 1),
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "list_projects",
    { title: "List projects", description: "The most recent Frameflow projects, newest first.", annotations: { readOnlyHint: true } },
    async () => {
      const projects = await listProjects(storage);
      if (!projects.length) return text("No projects yet.");
      return text(projects.map((p) => `- ${p.id}: "${p.title}", version ${p.latest}${p.hasVideo ? "" : " (no video)"}, updated ${p.updated}`).join("\n"));
    },
  );

  server.registerTool(
    "edit_scene",
    {
      title: "Edit one scene",
      description: "Changes one scene of a project (text, voiceover, template, sound effects, transition) and re-renders as a new version. Only the given fields change; `content` fields are merged into the scene's content. Unchanged voiceovers are reused, so this is faster than a new video.",
      inputSchema: {
        project_id: z.string(),
        scene_id: z.string(),
        changes: z
          .object({
            template: z.string().optional(),
            content: z.record(z.string(), z.unknown()).optional(),
            voiceover: z.string().optional(),
            estDuration: z.number().optional(),
            sfx: z.array(z.record(z.string(), z.unknown())).optional(),
            transitionOut: z.enum(["cut", "fade", "slide", "zoom", "wipe"]).optional(),
            textScale: z.number().min(0.7).max(1.4).optional().describe("main text size, 1 = normal (e.g. 1.25 for bigger text)"),
          })
          .describe("the fields to change"),
        ...renderArgs,
      },
    },
    async ({ project_id, scene_id, changes, quality, captions, formats }, extra) => {
      const found = await readPlan(storage, project_id);
      if (!found) return fail(`No project "${project_id}". Use list_projects to see what exists.`);
      const index = found.plan.scenes.findIndex((s) => s.id === scene_id);
      if (index < 0) return fail(`Project ${project_id} has no scene "${scene_id}"; its scenes are ${found.plan.scenes.map((s) => s.id).join(", ")}.`);
      const scenes = found.plan.scenes.map((s, i) => (i === index ? { ...s, ...changes, content: { ...(changes.template ? {} : s.content), ...(changes.content ?? {}) } } : s));
      const version = await nextVersion(storage, project_id);
      const r = await checkPlan(prepare({ ...found.plan, scenes }, project_id, version), { sfxIds, brandFixed: true });
      if (!r.ok) return fail(`The edit was not applied. Problems:\n${formatIssues(r.errors)}`);
      const job = await startRender(r.plan, { quality, captions, formats });
      return waitAndDescribe(job.id, extra);
    },
  );

  server.registerTool(
    "revise_video",
    {
      title: "Revise a whole video",
      description: "Replaces a project's scene plan with a revised one (e.g. calmer music, another voice, new brand colors, reordered or new scenes) and re-renders it as a new version. Start from get_project's plan.",
      inputSchema: { project_id: z.string(), plan: planArg, ...renderArgs },
    },
    async ({ project_id, plan, quality, captions, formats }, extra) => {
      if (!(await readPlan(storage, project_id))) return fail(`No project "${project_id}". Use create_video for a new video.`);
      const version = await nextVersion(storage, project_id);
      const r = await checkPlan(prepare(plan, project_id, version), { sfxIds, brandFixed: false });
      if (!r.ok) return fail(`The revision was not rendered. Problems:\n${formatIssues(r.errors)}`);
      const job = await startRender(r.plan, { quality, captions, formats });
      return waitAndDescribe(job.id, extra);
    },
  );

  return server;
}
