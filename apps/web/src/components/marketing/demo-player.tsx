"use client";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Showcase } from "./showcase-data";

// A real render with its real timeline underneath: scene blocks, beat ticks (taller on downbeats)
// and a playhead that follows the video. Sound is controlled by the parent, so it can stay on when
// the parent swaps in another version of the video.
export function DemoPlayer({ demo, muted, onMutedChange }: { demo: Showcase; muted: boolean; onMutedChange: (muted: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState(0);
  const downbeats = new Set(demo.downbeats);

  // keep the element in sync (React does not reliably update the muted attribute) and start the new
  // source from the top when the video changes
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = muted;
    if (v.paused) void v.play().catch(() => {});
  }, [muted, demo]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = video.current?.currentTime ?? 0;
      if (head.current) head.current.style.left = `${(t / demo.duration) * 100}%`;
      const i = demo.scenes.findIndex((s) => t >= s.start && t < s.end);
      setScene((prev) => (i >= 0 && i !== prev ? i : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [demo]);

  return (
    <div className="overflow-hidden rounded-[14px] bg-[oklch(0.11_0.012_283)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 truncate text-xs text-muted-foreground">
          {demo.title} · {demo.format} · {Math.round(demo.duration)} s
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-400/20 ring-inset">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Ready
        </span>
      </div>

      <div className="relative">
        <video
          ref={video}
          src={demo.src}
          poster={demo.poster}
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black object-cover"
        />
        <button
          type="button"
          onClick={() => onMutedChange(!muted)}
          className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-md transition hover:bg-black/70"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
        >
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>

      {/* timeline */}
      <div className="space-y-2.5 border-t border-white/[0.06] px-4 pt-3 pb-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Scene {scene + 1}/{demo.scenes.length} · <span className="text-foreground">{(demo.scenes[scene] ?? demo.scenes[0]).label}</span>
          </span>
          <span className="hidden sm:inline">
            {demo.music.track} · {Math.round(demo.music.bpm)} BPM · {demo.cutsOnBeat} of {demo.cuts} cuts on the beat
          </span>
        </div>
        <div className="relative">
          <div className="flex h-7 gap-1">
            {demo.scenes.map((s, i) => (
              <div
                key={i}
                style={{ width: `${((s.end - s.start) / demo.duration) * 100}%` }}
                className={cn(
                  "flex items-center overflow-hidden rounded-md px-2 text-[10px] font-medium whitespace-nowrap ring-1 transition-colors duration-300 ring-inset",
                  i === scene
                    ? "bg-[linear-gradient(90deg,color-mix(in_oklch,var(--brand-violet),transparent_55%),color-mix(in_oklch,var(--brand-teal),transparent_75%))] text-white ring-white/20"
                    : "bg-white/[0.04] text-muted-foreground ring-white/[0.06]",
                )}
              >
                <span className="truncate">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="relative mt-1.5 h-2.5">
            {demo.beats.map((b) => (
              <span
                key={b}
                style={{ left: `${(b / demo.duration) * 100}%` }}
                className={cn("absolute bottom-0 w-px rounded-full", downbeats.has(b) ? "h-2.5 bg-white/35" : "h-1.5 bg-white/15")}
              />
            ))}
          </div>
          <div ref={head} className="pointer-events-none absolute -top-1 -bottom-0.5 w-px bg-white shadow-[0_0_10px_2px_rgb(255_255_255/0.5)]" style={{ left: 0 }}>
            <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
