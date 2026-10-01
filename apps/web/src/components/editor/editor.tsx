"use client";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { renderFormats, restoreVersion } from "@/app/actions/projects";
import { ChatPanel } from "@/components/chat-panel";
import { RenderProgress } from "@/components/render-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectState } from "@/hooks/use-project-state";
import { useProjectState } from "@/hooks/use-project-state";
import { templateLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Timeline, type TimelineScene } from "./timeline";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
export interface EditorProps {
  projectId: string;
  title: string;
  format: string;
  status: string;
  version: { number: number; duration: number; formats: string[]; checks: Check[]; warnings: string[]; reused: string[]; note: string };
  scenes: TimelineScene[];
  peaks: number[];
  credits: string;
  versions: ProjectState["versions"];
  messages: ProjectState["messages"];
  renderingVersion: number | null;
  locked: string[] | null; // Pro customizations this version uses, when the account has no Pro: preview only
}

const FORMAT_FILE: Record<string, string> = { "16:9": "16x9", "9:16": "9x16", "1:1": "1x1" };

export function Editor(p: EditorProps) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [extra, setExtra] = useState<string[]>([]);
  // while a chat edit renders a new version, follow it here
  const state = useProjectState(p.projectId, true, 2500);
  const rendering = state?.status === "rendering" ? (state.versions.find((v) => v.status === "rendering")?.number ?? p.renderingVersion) : p.renderingVersion;
  const versions = state?.versions ?? p.versions;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (video.current) setTime(video.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (t: number) => {
    if (video.current) video.current.currentTime = Math.max(0, Math.min(t, p.version.duration - 0.05));
  };
  const refresh = useCallback(() => router.refresh(), [router]);
  const base = `/api/files/projects/${p.projectId}/v${p.version.number}`;
  const fileFor = (f: string) => (f === p.format ? "video.mp4" : `video-${FORMAT_FILE[f]}.mp4`);
  const scene = p.scenes.find((s) => s.id === selected);
  const others = ["16:9", "9:16", "1:1"].filter((f) => f !== p.format);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div className={cn("relative mx-auto overflow-hidden rounded-xl border bg-black", p.format === "9:16" ? "max-w-sm" : p.format === "1:1" ? "max-w-xl" : "")}>
          {p.locked && <Badge className="absolute top-3 left-3 z-10">Preview</Badge>}
          <video key={p.version.number} ref={video} src={`${base}/video.mp4`} poster={`${base}/poster.jpg`} controls playsInline className="block w-full" />
        </div>
        <Timeline scenes={p.scenes} peaks={p.peaks} duration={p.version.duration} time={time} selected={selected} onSeek={seek} onSelect={(id) => setSelected(id === selected ? null : id)} />
        {rendering && <RenderProgress projectId={p.projectId} version={rendering} compact onDone={refresh} />}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Version {p.version.number} · {p.version.duration.toFixed(1)} s · {p.version.note}
          </span>
          <span className={p.version.checks.every((c) => c.ok) ? "text-emerald-400" : "text-amber-400"}>
            {p.version.checks.filter((c) => c.ok).length}/{p.version.checks.length} quality checks passed
          </span>
          {p.version.reused.length > 0 && <span>Reused: {p.version.reused.join(", ")}</span>}
        </div>
      </div>

      <Tabs defaultValue="chat" className="lg:sticky lg:top-20 lg:self-start">
        <TabsList className="w-full">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="download">Download</TabsTrigger>
        </TabsList>
        <TabsContent value="chat">
          <ChatPanel
            className="h-[560px]"
            projectId={p.projectId}
            initial={p.messages}
            render
            scene={scene ? { id: scene.id, label: `scene ${p.scenes.indexOf(scene) + 1} (${templateLabel(scene.template)})` } : null}
            suggestions={scene ? ["Make this text bigger", "Shorter voiceover here", "Change this headline"] : ["Calmer music", "Change the voice", "Make it more energetic"]}
            onDone={refresh}
          />
          <p className="mt-2 text-xs text-muted-foreground">Click a scene on the timeline to change just that scene. Every change renders a new version; older ones stay in Versions.</p>
        </TabsContent>
        <TabsContent value="versions" className="space-y-2">
          {versions.map((v) => (
            <div key={v.number} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{v.number}</span>
                  {v.number === p.version.number && <Badge>Current</Badge>}
                  {v.status !== "ready" && <Badge variant={v.status === "failed" ? "destructive" : "secondary"}>{v.status}</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground" title={v.error ?? v.note}>
                  {v.error ?? v.note}
                  {v.duration ? ` · ${v.duration.toFixed(1)} s` : ""}
                </div>
              </div>
              {v.status === "ready" && v.number !== p.version.number && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || !!rendering}
                  onClick={() =>
                    start(async () => {
                      const r = await restoreVersion(p.projectId, v.number);
                      if (!r.ok) toast.error(r.error ?? "Could not restore");
                      else refresh();
                    })
                  }
                >
                  Restore
                </Button>
              )}
            </div>
          ))}
        </TabsContent>
        <TabsContent value="download" className="space-y-5">
          {p.locked && (
            <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/[0.06] p-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Lock className="size-4" />
                Downloading this video needs Pro
              </div>
              <p className="text-muted-foreground">
                It uses Pro customizations ({p.locked.join(", ")}). You can keep editing and watching it with a watermark. Upgrade to download it
                without the watermark, or switch back to a free voice and default settings in the storyboard.
              </p>
              <Button asChild className="w-full">
                <Link href="/billing">Upgrade to Pro</Link>
              </Button>
            </div>
          )}
          <div className={cn("space-y-2", p.locked && "pointer-events-none opacity-40")} aria-disabled={!!p.locked}>
            {p.version.formats.map((f) => (
              <Button key={f} asChild variant={f === p.format ? "default" : "secondary"} className="w-full justify-between">
                <a href={`${base}/${fileFor(f)}?download=1&name=${encodeURIComponent(p.title)}`}>
                  <span>Video {f}</span>
                  <span className="text-xs opacity-70">1080p MP4</span>
                </a>
              </Button>
            ))}
            <Button asChild variant="secondary" className="w-full justify-between">
              <a href={`${base}/video-social.mp4?download=1&name=${encodeURIComponent(p.title)}`}>
                <span>Smaller file for social</span>
                <span className="text-xs opacity-70">{p.format}</span>
              </a>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="ghost" size="sm">
                <a href={`${base}/captions.srt?download=1&name=${encodeURIComponent(p.title)}`}>Captions .srt</a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={`${base}/captions.vtt?download=1&name=${encodeURIComponent(p.title)}`}>Captions .vtt</a>
              </Button>
            </div>
          </div>
          {others.some((f) => !p.version.formats.includes(f)) && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="text-sm">Also make it in</div>
              <div className="flex gap-2">
                {others
                  .filter((f) => !p.version.formats.includes(f))
                  .map((f) => (
                    <label key={f} className={cn("cursor-pointer rounded-md border px-3 py-1.5 text-sm", extra.includes(f) && "border-primary bg-primary/10")}>
                      <input type="checkbox" className="sr-only" checked={extra.includes(f)} onChange={(e) => setExtra((x) => (e.target.checked ? [...x, f] : x.filter((y) => y !== f)))} />
                      {f}
                    </label>
                  ))}
              </div>
              <Button
                size="sm"
                disabled={!extra.length || pending || !!rendering}
                onClick={() =>
                  start(async () => {
                    const r = await renderFormats(p.projectId, [...p.version.formats.filter((f) => f !== p.format), ...extra]);
                    if (r && !r.ok) toast.error(r.error ?? "Could not start");
                  })
                }
              >
                Render these (one render)
              </Button>
            </div>
          )}
          <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Credits (show the music credit with the video)</div>
            <pre className="font-sans whitespace-pre-wrap">{p.credits}</pre>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Quality checks</summary>
            <ul className="mt-2 space-y-1">
              {p.version.checks.map((c) => (
                <li key={c.name}>
                  <span className={c.ok ? "text-emerald-400" : "text-amber-400"}>{c.ok ? "✓" : "✗"}</span> {c.name}: {c.detail}
                </li>
              ))}
              {p.version.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          </details>
        </TabsContent>
      </Tabs>
    </div>
  );
}
