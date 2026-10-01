import { ArrowRight, AudioLines, Check, Clock, Globe, Ratio, Sparkles } from "lucide-react";
import Link from "next/link";
import { Aurora } from "@/components/fx/aurora";
import { PointerGlow } from "@/components/fx/pointer-glow";
import { Button } from "@/components/ui/button";
import { HeroDemo } from "./hero-demo";
import { Accent } from "./section-heading";
import { TypingPrompt } from "./typing-prompt";

const CHIPS = [
  { icon: Globe, label: "yourbrand.com" },
  { icon: Ratio, label: "16:9 · 9:16 · 1:1" },
  { icon: Clock, label: "15 to 90 s" },
  { icon: AudioLines, label: "Voice + music" },
];

export function Hero({ freeVideos }: { freeVideos: number }) {
  return (
    <section className="relative isolate overflow-hidden pt-32 pb-24 sm:pt-40">
      <Aurora />
      <PointerGlow />
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <Link
          href="/signup"
          className="group inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3 pl-1 text-xs text-muted-foreground backdrop-blur transition hover:border-white/20"
        >
          <span className="rounded-full bg-primary/20 px-2 py-0.5 font-medium text-[oklch(0.85_0.1_292)] ring-1 ring-primary/30">New</span>
          <span className="shimmer-text font-medium">Edit any scene just by chatting</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <h1 className="mx-auto mt-8 max-w-4xl animate-fade-up text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance [animation-delay:80ms] sm:text-7xl">
          <span className="text-gradient">One line in.</span>
          <br />
          <span className="text-gradient">A finished </span>
          <Accent>motion video</Accent>
          <span className="text-gradient"> out.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-base text-pretty text-muted-foreground [animation-delay:160ms] sm:text-lg">
          Frameflow reads your brand from your website, writes the script, records the voiceover, picks the music and cuts every scene
          on the beat. You get a video that is ready to post.
        </p>

        <div className="mx-auto mt-10 max-w-2xl animate-fade-up [animation-delay:240ms]">
          <div className="glass shine-border rounded-2xl border border-white/[0.07] p-2">
            <div className="flex items-center gap-3 rounded-xl bg-black/25 py-2 pr-2 pl-4 ring-1 ring-white/[0.06]">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-1 text-left text-sm text-foreground/90 sm:text-base">
                <TypingPrompt />
              </div>
              <Button asChild size="lg" className="group shrink-0">
                <Link href="/signup">
                  <span className="hidden sm:inline">Generate</span>
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-2 pt-2.5 pb-1">
              {CHIPS.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-white/[0.06]">
                  <Icon className="size-3" />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {["Free plan", "No card needed", `${freeVideos} videos a month`].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[oklch(0.8_0.13_205)]" />
                {t}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div id="demo" className="relative mx-auto mt-20 max-w-5xl animate-fade-up px-4 [animation-delay:380ms] sm:px-6">
        <div aria-hidden className="absolute inset-x-16 top-10 -bottom-8 -z-10 rounded-[3rem] bg-[oklch(0.55_0.24_290/0.4)] blur-[100px]" />
        <HeroDemo />
      </div>
    </section>
  );
}
