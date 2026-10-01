import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { db, effectiveTier } from "@frameflow/db";
import type { NextRequest } from "next/server";
import { currentUser, isAdmin } from "@/lib/auth";
import { storagePath } from "@/lib/storage";

// Serves a storage key to its owner, e.g. /api/files/projects/<id>/v2/video.mp4. Only finished outputs,
// research images and the user's own uploads can be read; nothing else in storage/ (plans, work files).
// Admins can also open other users' project files (support: watching a video that went wrong).
const VERSION_FILE = /^(video(-(16x9|9x16|1x1))?\.mp4|video-social\.mp4|poster\.jpg|captions\.(srt|vtt)|credits\.txt|waveform\.json|mix\.m4a)$/;
const RESEARCH_FILE = /^(screenshot(-mobile)?\.png|logo\.(svg|png|jpe?g|webp))$/;
const UPLOAD_FILE = /^[a-f0-9]{24}\.(png|jpg|webp|svg)$/;
const TYPES: Record<string, string> = {
  mp4: "video/mp4", m4a: "audio/mp4", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml",
  srt: "application/x-subrip; charset=utf-8", vtt: "text/vtt; charset=utf-8", txt: "text/plain; charset=utf-8", json: "application/json",
};

// A file as a web stream that stops reading when the browser cancels (the video player does that on
// every seek) and only reads ahead as fast as the client takes the bytes.
function fileStream(file: string, range?: { start: number; end: number }): ReadableStream<Uint8Array> {
  const node = createReadStream(file, range);
  return new ReadableStream({
    start(controller) {
      node.on("data", (chunk) => {
        try {
          controller.enqueue(new Uint8Array(chunk as Buffer));
          if ((controller.desiredSize ?? 1) <= 0) node.pause();
        } catch {
          node.destroy(); // the client went away
        }
      });
      node.on("end", () => {
        try {
          controller.close();
        } catch {}
      });
      node.on("error", (e) => {
        try {
          controller.error(e);
        } catch {}
      });
    },
    pull() {
      node.resume();
    },
    cancel() {
      node.destroy();
    },
  });
}

async function allowed(parts: string[], user: { id: string; email: string; role: string }): Promise<boolean> {
  const [area, owner, a, b] = parts;
  if (area === "uploads") return parts.length === 3 && (owner === user.id || isAdmin(user)) && UPLOAD_FILE.test(a);
  const project = owner ? await db().project.findFirst({ where: { id: owner, ...(isAdmin(user) ? {} : { userId: user.id }) }, select: { id: true } }) : null;
  if (!project) return false;
  if (area === "projects") return parts.length === 4 && /^v\d+$/.test(a) && VERSION_FILE.test(b);
  if (area === "research") return parts.length === 3 && RESEARCH_FILE.test(a);
  return false;
}

// A video that uses Pro customizations (qa.pro, set at render) is locked for accounts without Pro: the player
// gets the watermarked preview.mp4 instead of video.mp4, and nothing else of it can be downloaded. Admins see it as is.
const OPEN_WHEN_LOCKED = /^(poster\.jpg|waveform\.json|credits\.txt)$/;
async function locked(parts: string[], user: { email: string; role: string; tier: string; proUntil: Date | null }): Promise<boolean> {
  if (parts[0] !== "projects" || parts.length !== 4 || isAdmin(user) || effectiveTier(user) === "pro") return false;
  const version = await db().version.findUnique({ where: { projectId_number: { projectId: parts[1], number: Number(parts[2].slice(1)) } }, select: { qa: true } });
  return ((version?.qa as { pro?: string[] } | null)?.pro ?? []).length > 0;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[...key]">) {
  const user = await currentUser();
  const { key } = await ctx.params;
  if (!user || key.some((p) => p === ".." || p === "." || p.includes("\0")) || !(await allowed(key, user))) {
    return new Response("Not found", { status: 404 });
  }
  const name = key[key.length - 1];
  const download = !!req.nextUrl.searchParams.get("download");
  let file = storagePath(key.join("/"));
  let preview = false;
  if (!OPEN_WHEN_LOCKED.test(name) && (await locked(key, user))) {
    if (name !== "video.mp4" || download) return new Response("This video uses Pro customizations. Upgrade to Pro to download it.", { status: 403 });
    file = storagePath([...key.slice(0, 3), "preview.mp4"].join("/"));
    preview = true;
  }
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers = new Headers({
    "Content-Type": TYPES[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    // not cached when it's the preview: after upgrading, the same URL gives the real video
    "Cache-Control": preview ? "private, no-store" : "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    // an uploaded SVG opened directly can't run anything
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox",
  });
  if (download) {
    const title = req.nextUrl.searchParams.get("name")?.replace(/[^\w.-]+/g, "-").slice(0, 60) || "frameflow";
    headers.set("Content-Disposition", `attachment; filename="${title}-${name}"`);
  }

  // byte ranges, so the video player can seek
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(fileStream(file, { start, end }), { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(fileStream(file), { headers });
}
