import { Bell, Globe, MousePointerClick, Sparkles, Waves, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHOWCASE } from "./showcase-data";

// CSS-only illustrations for the feature cards. The numbers are from the demo render
// (storage/projects/frameflow-intro/v1/qa.json): cut shifts, loudness, the voice/music balance.

const BARS = Array.from({ length: 64 }, (_, i) => Math.round(28 + 66 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.17 + 0.6))));
const CUTS = [
  { at: 18, shift: "+102 ms" },
  { at: 45, shift: "+213 ms" },
  { at: 67, shift: "−209 ms" },
  { at: 86, shift: "−95 ms" },
];

export function BeatVisual() {
  return (
    <div className="relative mt-8 h-36">
      <div className="absolute inset-x-0 top-1/2 flex h-24 -translate-y-1/2 items-center gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className="flex-1 origin-center animate-bar rounded-full bg-[linear-gradient(to_top,color-mix(in_oklch,var(--brand-violet),transparent_60%),var(--brand-violet))]"
            style={{ height: `${h}%`, animationDelay: `${-((i * 7) % 16) * 0.07}s` }}
          />
        ))}
      </div>
      {CUTS.map((c, i) => (
        <div key={c.at} className="absolute inset-y-0" style={{ left: `${c.at}%` }}>
          <div className="absolute inset-y-2 w-px bg-[linear-gradient(to_bottom,transparent,var(--brand-teal),transparent)]" />
          <span
            data-anim
            className="absolute top-0 -translate-x-1/2 animate-pop rounded-md bg-[oklch(0.2_0.03_205)] px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-[oklch(0.85_0.1_205)] ring-1 ring-[oklch(0.8_0.13_205/0.35)]"
            style={{ animationDelay: `${300 + i * 180}ms` }}
          >
            cut {c.shift}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BrandVisual() {
  const swatches = ["#7C5CFF", "#22D3EE", "#0B0B14", "#F5F5FA"];
  return (
    <div className="mt-8 space-y-4">
      <div className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground ring-1 ring-white/[0.07]">
        <Globe className="size-3.5" />
        yourbrand.com
        <span className="absolute inset-y-0 w-1/4 animate-[scan_2.8s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--brand-teal),transparent_75%),transparent)]" />
      </div>
      <div className="flex items-center gap-2">
        {swatches.map((c, i) => (
          <span
            key={c}
            data-anim
            className="size-9 animate-pop rounded-lg ring-1 ring-white/15"
            style={{ background: c, animationDelay: `${250 + i * 120}ms` }}
          />
        ))}
        <span data-anim className="ml-auto animate-pop text-right" style={{ animationDelay: "800ms" }}>
          <span className="block text-2xl leading-none font-semibold">Aa</span>
          <span className="text-[10px] text-muted-foreground">Space Grotesk</span>
        </span>
      </div>
    </div>
  );
}

export function MixVisual() {
  const rows = [
    { label: "Voice", value: "−16 LUFS", width: 78, tone: "var(--brand-violet)" },
    { label: "Music under voice", value: "−21 LUFS", width: 56, tone: "oklch(0.72 0.17 330)" },
    { label: "Master", value: "−14 LUFS", width: 88, tone: "var(--brand-teal)" },
  ];
  return (
    <div className="mt-8 space-y-3.5">
      {rows.map((r, i) => (
        <div key={r.label} className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{r.label}</span>
            <span className="font-mono text-foreground/80">{r.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              data-anim
              className="h-full origin-left animate-fill-x rounded-full"
              style={{ width: `${r.width}%`, background: r.tone, boxShadow: `0 0 12px 0 ${r.tone}`, animationDelay: `${200 + i * 200}ms` }}
            />
          </div>
        </div>
      ))}
      <div className="text-[11px] text-muted-foreground">True peak −1 dBTP · music ducks under every word</div>
    </div>
  );
}

export function ChatVisual() {
  return (
    <div className="mt-8 space-y-2.5 text-xs">
      <div data-anim className="ml-auto w-fit max-w-[85%] animate-fade-up rounded-2xl rounded-br-md bg-primary/85 px-3 py-2 text-white" style={{ animationDelay: "150ms" }}>
        Make the music calmer and the headline shorter
      </div>
      <div data-anim className="w-fit max-w-[90%] animate-fade-up rounded-2xl rounded-bl-md bg-white/[0.06] px-3 py-2 ring-1 ring-white/[0.07]" style={{ animationDelay: "650ms" }}>
        <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Sparkles className="size-3 text-primary" /> Director
        </div>
        Switched to a calmer track and shortened the hook. Rendering version 2
        <span className="inline-flex gap-0.5 pl-0.5">
          {[0, 1, 2].map((d) => (
            <span key={d} className="animate-[dots_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${d * 0.18}s` }}>
              .
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export function FormatsVisual() {
  // the delays line each still up with its third of the 7 s aspect-morph cycle
  const formats = [
    { label: "16:9", img: SHOWCASE.clearsight.poster, delay: "0s" },
    { label: "9:16", img: SHOWCASE.kettle.poster, delay: "-4.69s" },
    { label: "1:1", img: SHOWCASE.pulsefit.poster, delay: "-2.38s" },
  ];
  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      <div className="flex h-36 items-center">
        <div className="relative animate-aspect overflow-hidden rounded-lg bg-black ring-1 ring-white/15">
          {formats.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.label}
              src={f.img}
              alt=""
              className="absolute inset-0 size-full animate-[seg-on_7s_cubic-bezier(0.65,0,0.35,1)_infinite] object-cover"
              style={{ animationDelay: f.delay }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 text-[11px] font-medium">
        {formats.map((f) => (
          <span key={f.label} className="relative rounded-md px-2 py-0.5 text-muted-foreground">
            <span
              className="absolute inset-0 animate-[seg-on_7s_cubic-bezier(0.65,0,0.35,1)_infinite] rounded-md bg-white/10 ring-1 ring-white/15"
              style={{ animationDelay: f.delay }}
            />
            <span className="relative">{f.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function CaptionsVisual() {
  const words = "Type one line. Get a finished video.".split(" ");
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-x-2 gap-y-1 rounded-xl bg-black/30 px-4 py-5 text-center text-xl font-semibold tracking-tight ring-1 ring-white/[0.06] sm:text-2xl">
      {words.map((w, i) => (
        <span key={i} className={cn("animate-[word-on_5s_ease-in-out_infinite]", w === "video." && "text-brand-gradient")} style={{ animationDelay: `${i * 0.32}s` }}>
          {w}
        </span>
      ))}
    </div>
  );
}

export function SfxVisual() {
  const cues = [
    { at: 6, label: "whoosh", icon: Waves },
    { at: 30, label: "pop", icon: Zap },
    { at: 38, label: "pop", icon: Zap },
    { at: 46, label: "pop", icon: Zap },
    { at: 66, label: "click", icon: MousePointerClick },
    { at: 88, label: "impact", icon: Bell },
  ];
  return (
    <div className="relative mt-10 h-24">
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
      {cues.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${c.at}%` }}>
            <span
              className="flex size-8 animate-[ping-at_6s_linear_infinite] items-center justify-center rounded-full bg-[oklch(0.2_0.03_205)] ring-1 ring-[oklch(0.8_0.13_205/0.35)]"
              style={{ animationDelay: `${(c.at / 100) * 6}s` }}
            >
              <Icon className="size-3.5 text-[oklch(0.85_0.1_205)]" />
            </span>
            <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">{c.label}</span>
          </div>
        );
      })}
      <div className="absolute -inset-y-1 w-px animate-[playhead_6s_linear_infinite] bg-white shadow-[0_0_10px_2px_rgb(255_255_255/0.45)]" />
    </div>
  );
}
