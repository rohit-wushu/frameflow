"use client";
import { templateLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export interface TimelineScene {
  id: string;
  template: string;
  start: number;
  duration: number;
}

// Scene blocks over the audio waveform; click to select a scene and jump to it.
export function Timeline({ scenes, peaks, duration, time, selected, onSeek, onSelect }: { scenes: TimelineScene[]; peaks: number[]; duration: number; time: number; selected: string | null; onSeek: (t: number) => void; onSelect: (id: string) => void }) {
  const pct = (t: number) => `${(t / duration) * 100}%`;
  const bars = peaks.length;
  const path = peaks.map((p, i) => `M${i + 0.5} ${20 - p * 19}V${20 + p * 19}`).join("");
  return (
    <div className="relative select-none space-y-1.5">
      <div className="relative h-14">
        {scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              onSelect(s.id);
              onSeek(s.start + 0.05);
            }}
            className={cn(
              "absolute inset-y-0 overflow-hidden rounded-md border px-2 text-left text-xs transition",
              selected === s.id ? "border-primary bg-primary/25" : "bg-muted/60 hover:bg-muted",
            )}
            style={{ left: `calc(${pct(s.start)} + 1px)`, width: `calc(${pct(s.duration)} - 2px)` }}
            title={`Scene ${i + 1}: ${templateLabel(s.template)} (${s.duration.toFixed(1)} s)`}
          >
            <div className="truncate pt-1.5 font-medium">{i + 1}</div>
            <div className="truncate text-muted-foreground">{templateLabel(s.template)}</div>
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${bars} 40`}
        preserveAspectRatio="none"
        className="h-10 w-full cursor-pointer text-primary/60"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - r.left) / r.width) * duration);
        }}
      >
        <path d={path} stroke="currentColor" strokeWidth={0.7} />
      </svg>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: pct(Math.min(time, duration)) }} />
    </div>
  );
}
