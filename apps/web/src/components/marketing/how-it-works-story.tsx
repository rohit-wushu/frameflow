"use client";
import { Check, Clapperboard, Globe, LoaderCircle, PenLine, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AutoVideo } from "@/components/fx/auto-video";
import { Reveal } from "@/components/fx/reveal";
import { cn } from "@/lib/utils";
import { SHOWCASE } from "./showcase-data";

// "How it works" as a scroll story: the step crossing the middle of the screen drives a sticky app
// window that acts that step out, ending on the real Ledgerly render. On small screens each step
// shows its own window inline.
const demo = SHOWCASE.ledgerly;

const STEPS = [
  { icon: PenLine, title: "Describe it", text: "One line about the video. Add your website and pick a format. That is the whole brief." },
  { icon: Globe, title: "We read your brand", text: "Logo, colors and fonts from your site, plus the facts on the page. Nothing is invented." },
  { icon: WandSparkles, title: "Review the storyboard", text: "An AI director writes the script and picks a scene for every line. Change anything before it renders." },
  { icon: Clapperboard, title: "Get the final cut", text: "Voice, music, sound effects and motion, mixed and cut on the beat. Download the MP4 with captions." },
];

export function HowItWorksStory() {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mt-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
      <ol className="space-y-5 lg:space-y-0">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} ref={(el) => void (items.current[i] = el)} data-step={i} className="lg:flex lg:min-h-[64vh] lg:items-center">
            <div
              className={cn(
                "w-full rounded-2xl p-6 transition duration-500",
                i === active ? "bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_50px_-30px_rgb(30_20_60/0.3)] ring-1 ring-black/[0.06]" : "lg:opacity-45",
                "max-lg:bg-white max-lg:ring-1 max-lg:ring-black/[0.06]",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7C5CFF,#22D3EE)] shadow-[0_8px_20px_-8px_rgb(124_92_255/0.7)]">
                  <Icon className="size-5 text-white" />
                </span>
                <span className="font-mono text-sm text-neutral-400">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight text-neutral-950">{title}</h3>
              <p className="mt-2 leading-relaxed text-neutral-600">{text}</p>
              <Reveal className="mt-6 lg:hidden">
                <Window>
                  <Stage step={i} />
                </Window>
              </Reveal>
            </div>
          </li>
        ))}
      </ol>

      <div className="hidden lg:block">
        <div className="sticky top-[calc(50vh-15.5rem)]">
          <Window>
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn("absolute inset-0 transition duration-700", i === active ? "opacity-100" : "pointer-events-none scale-[0.98] opacity-0")}
              >
                {/* remount on activation so the stage plays from the start */}
                {i === active && <Stage step={i} />}
              </div>
            ))}
          </Window>
          <div className="mt-5 flex justify-center gap-2">
            {STEPS.map((s, i) => (
              <span key={s.title} className={cn("h-1.5 rounded-full transition-all duration-500", i === active ? "w-8 bg-[#7C5CFF]" : "w-1.5 bg-black/15")} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Window({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0E0E14] text-white shadow-[0_40px_90px_-40px_rgb(20_10_60/0.6)] ring-1 ring-black/10">
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 text-xs text-white/50">Frameflow · New video</span>
      </div>
      <div className="relative lg:h-[27rem]">{children}</div>
    </div>
  );
}

function Stage({ step }: { step: number }) {
  if (step === 0) return <DescribeStage />;
  if (step === 1) return <BrandStage />;
  if (step === 2) return <StoryboardStage />;
  return <RenderStage />;
}

// a one-shot entrance; inside a mobile <Reveal> it waits until the window is on screen
const enter = (delayMs: number) => ({ "data-anim": "", style: { animationDelay: `${delayMs}ms` } });

function Typed({ text, startMs = 300 }: { text: string; startMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      let i = 0;
      const tick = () => {
        i += 1;
        setN(i);
        if (i < text.length) timer = setTimeout(tick, 28);
      };
      timer = setTimeout(tick, startMs);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [text, startMs]);
  return (
    <span ref={ref}>
      {text.slice(0, n)}
      <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-caret bg-[#9B87FF]" />
    </span>
  );
}

function DescribeStage() {
  return (
    <div className="space-y-4 p-6">
      <div className="text-xs font-medium text-white/50">What is the video about?</div>
      <div className="min-h-24 rounded-xl bg-white/[0.05] p-4 text-[15px] leading-relaxed ring-1 ring-white/10">
        <Typed text="A launch video for Ledgerly, our invoicing app. Calm and premium, for small studios." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div {...enter(2600)} className="animate-fade-up space-y-1.5">
          <div className="text-xs text-white/50">Website</div>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-sm ring-1 ring-white/10">
            <Globe className="size-3.5 text-white/50" />
            ledgerly.example
          </div>
        </div>
        <div {...enter(2800)} className="animate-fade-up space-y-1.5">
          <div className="text-xs text-white/50">Format</div>
          <div className="flex gap-1.5 text-xs">
            <span className="rounded-md bg-[#7C5CFF]/25 px-2.5 py-2 ring-1 ring-[#7C5CFF]/60">16:9</span>
            <span className="rounded-md bg-white/[0.05] px-2.5 py-2 text-white/60 ring-1 ring-white/10">9:16</span>
            <span className="rounded-md bg-white/[0.05] px-2.5 py-2 text-white/60 ring-1 ring-white/10">1:1</span>
          </div>
        </div>
      </div>
      <div {...enter(3200)} className="flex animate-pop justify-end pt-2">
        <span className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(180deg,#9B87FF,#7C5CFF)] px-4 py-2.5 text-sm font-semibold shadow-[0_10px_30px_-10px_#7C5CFF]">
          <Sparkles className="size-4" />
          Generate
        </span>
      </div>
    </div>
  );
}

function BrandStage() {
  const swatches = demo.colors;
  return (
    <div className="grid h-full gap-5 p-6 sm:grid-cols-[1.1fr_1fr]">
      {/* the website being read */}
      <div className="relative overflow-hidden rounded-xl bg-[#F6F8F5] p-3 ring-1 ring-white/10">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-[#10B981]" />
          <span className="h-2 w-12 rounded-full bg-[#0B1F17]/70" />
          <span className="ml-auto h-2 w-8 rounded-full bg-[#0B1F17]/20" />
          <span className="h-2 w-8 rounded-full bg-[#0B1F17]/20" />
        </div>
        <div className="mt-6 h-3 w-4/5 rounded-full bg-[#0B1F17]/80" />
        <div className="mt-2 h-3 w-3/5 rounded-full bg-[#0B1F17]/80" />
        <div className="mt-3 h-2 w-4/5 rounded-full bg-[#0B1F17]/20" />
        <div className="mt-1.5 h-2 w-2/3 rounded-full bg-[#0B1F17]/20" />
        <div className="mt-4 h-6 w-20 rounded-md bg-[#10B981]" />
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-14 rounded-lg bg-white ring-1 ring-black/5" />
          ))}
        </div>
        <span className="absolute inset-x-0 h-10 animate-[scan-y_2.6s_ease-in-out_infinite] bg-[linear-gradient(to_bottom,transparent,rgb(124_92_255/0.35),transparent)]" />
      </div>
      {/* what came out of it */}
      <div className="space-y-4 text-sm">
        <div {...enter(300)} className="animate-fade-up">
          <div className="text-xs text-white/50">Logo</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight">Ledgerly</div>
        </div>
        <div {...enter(600)} className="animate-fade-up">
          <div className="text-xs text-white/50">Colors</div>
          <div className="mt-1.5 flex gap-1.5">
            {swatches.map((c, i) => (
              <span key={c} {...enter(700 + i * 120)} className="size-8 animate-pop rounded-lg ring-1 ring-white/20" style={{ background: c, animationDelay: `${700 + i * 120}ms` }} />
            ))}
          </div>
        </div>
        <div {...enter(1300)} className="animate-fade-up">
          <div className="text-xs text-white/50">Fonts</div>
          <div className="mt-1">Plus Jakarta Sans · Inter</div>
        </div>
        <div {...enter(1600)} className="animate-fade-up">
          <div className="text-xs text-white/50">Facts from the page</div>
          <ul className="mt-1 space-y-1 text-white/80">
            <li>· Invoices ready in seconds</li>
            <li>· Automatic, polite reminders</li>
            <li>· Cash flow at a glance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StoryboardStage() {
  return (
    <div className="h-full overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between text-xs text-white/50">
        <span>Storyboard · {demo.scenes.length} scenes · {Math.round(demo.duration)} s</span>
        <span className="text-[#9B87FF]">Edit any scene</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {demo.scenes.map((s, i) => (
          <div key={s.id} {...enter(150 + i * 140)} className="animate-pop overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.clipPoster} alt="" className="aspect-video w-full object-cover" />
            <div className="px-2 py-1.5">
              <div className="text-[11px] font-semibold">{s.label}</div>
              <div className="truncate text-[10px] text-white/50">
                {(s.end - s.start).toFixed(1)} s
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RENDER_STEPS = ["Making voice", "Timing the words", "Picking music", "Cutting on the beat", "Mixing audio", "Rendering"];

function RenderStage() {
  return (
    <div className="grid h-full gap-5 p-6 sm:grid-cols-[11rem_1fr]">
      <ul className="space-y-3 text-sm">
        {RENDER_STEPS.map((s, i) => (
          <li key={s} {...enter(200 + i * 330)} className="flex animate-fade-up items-center gap-2.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/40">
              <Check className="size-3 text-emerald-300" />
            </span>
            {s}
          </li>
        ))}
        <li {...enter(2300)} className="animate-fade-up pt-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div {...enter(2300)} className="h-full origin-left animate-fill-x rounded-full bg-[linear-gradient(90deg,#7C5CFF,#22D3EE)]" style={{ animationDelay: "2300ms" }} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-white/50">
            <LoaderCircle className="size-3 animate-spin" /> about a minute on a laptop
          </div>
        </li>
      </ul>
      <div {...enter(2900)} className="flex animate-fade-up flex-col justify-center">
        <div className="overflow-hidden rounded-xl ring-1 ring-white/15" style={{ background: demo.background }}>
          <AutoVideo src={demo.src} poster={demo.poster} className="aspect-video w-full object-cover" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 font-medium text-emerald-300 ring-1 ring-emerald-400/25">Ready</span>
          <span className="text-white/60">
            {demo.cutsOnBeat} of {demo.cuts} cuts on the beat · {demo.loudness} LUFS · MP4 + captions
          </span>
        </div>
      </div>
    </div>
  );
}
