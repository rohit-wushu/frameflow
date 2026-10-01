"use client";
import { Check, Mic } from "lucide-react";
import { useState } from "react";
import { AutoVideo } from "@/components/fx/auto-video";
import { TiltOnScroll } from "@/components/fx/tilt-on-scroll";
import { cn } from "@/lib/utils";
import { DemoPlayer } from "./demo-player";
import { MusicCredit } from "./music-credit";
import { SHOWCASE, type Showcase } from "./showcase-data";

// The hero product shot: the Ledgerly video with an English or a Hindi voiceover (same visuals).
const TABS = [
  { label: "English", demo: SHOWCASE.ledgerly },
  { label: "हिंदी", demo: SHOWCASE.ledgerlyHi },
];

export function HeroDemo() {
  const [tab, setTab] = useState(0);
  const [muted, setMuted] = useState(true);
  const demo = TABS[tab].demo;

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-2">
        <div role="tablist" aria-label="Voiceover language" className="glass relative flex rounded-full border border-white/10 p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-28 rounded-full bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary),white_16%),var(--primary))] shadow-[0_6px_20px_-8px_var(--primary)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${tab * 100}%)` }}
          />
          {TABS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={i === tab}
              onClick={() => {
                setTab(i);
                // the visuals are the same, so the switch is only worth it with sound
                setMuted(false);
              }}
              className={cn(
                "relative z-10 inline-flex w-28 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-medium transition-colors",
                i === tab ? "text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Mic className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {tab === 0 ? "Same video, two voiceovers. Switch to hear it in Hindi." : "Same visuals, Hindi voiceover. The on-screen text stays in English."}
        </p>
      </div>

      <TiltOnScroll>
        <div className="relative">
          {/* two more renders fanned out behind the main one (wide screens only) */}
          <SideVideo demo={SHOWCASE.kettle} className="top-16 -left-44 w-52 -rotate-[9deg]" />
          <SideVideo demo={SHOWCASE.pulsefit} className="top-44 -right-48 w-60 rotate-[8deg]" />
          <div className="glass shine-border relative z-10 rounded-2xl p-px">
            <DemoPlayer demo={demo} muted={muted} onMutedChange={setMuted} />
          </div>
        </div>
      </TiltOnScroll>
      <FloatingChip className="top-40 -left-10" delay="0s">
        <Mic className="size-3.5 text-primary" />
        Voiceover by {demo.voice}
      </FloatingChip>
      <FloatingChip className="top-[58%] -right-12" delay="-2.5s">
        <span className="flex -space-x-1">
          {demo.colors.slice(0, 2).map((c) => (
            <span key={c} className="size-3.5 rounded-full ring-2 ring-black/40" style={{ background: c }} />
          ))}
        </span>
        {demo.brand} colors and {demo.font}
      </FloatingChip>
      <FloatingChip className="bottom-44 -left-14" delay="-4.5s">
        <Check className="size-3.5 text-emerald-300" />
        {demo.cutsOnBeat} of {demo.cuts} cuts on the beat
      </FloatingChip>
      <p className="mt-5 text-center text-[11px] text-muted-foreground/70">
        Example brands, rendered by Frameflow. <MusicCredit demos={[demo, SHOWCASE.kettle, SHOWCASE.pulsefit]} />
      </p>
    </>
  );
}

function SideVideo({ demo, className }: { demo: Showcase; className: string }) {
  return (
    <div aria-hidden className={cn("absolute z-0 hidden rounded-[1.1rem] bg-black/40 p-1.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/15 backdrop-blur-md xl:block", className)}>
      <AutoVideo
        src={demo.src}
        poster={demo.poster}
        className={cn("w-full rounded-xl object-cover", demo.format === "9:16" ? "aspect-[9/16]" : demo.format === "1:1" ? "aspect-square" : "aspect-video")}
      />
      <div className="px-1.5 pt-1.5 pb-0.5 text-[10px] text-white/60">
        {demo.brand} · {demo.format}
      </div>
    </div>
  );
}

function FloatingChip({ children, className, delay }: { children: React.ReactNode; className: string; delay: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "glass absolute z-10 hidden animate-float items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium whitespace-nowrap text-foreground/90 lg:flex",
        className,
      )}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}
