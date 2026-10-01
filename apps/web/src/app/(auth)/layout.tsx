import { Check } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Aurora } from "@/components/fx/aurora";
import { MusicCredit } from "@/components/marketing/music-credit";
import { SHOWCASE } from "@/components/marketing/showcase-data";
import { currentUser } from "@/lib/auth";

const { kettle, pulsefit } = SHOWCASE;
const POINTS = ["Brand from your website", "Cuts on the beat", "Voiceover and captions", "16:9, 9:16 and 1:1"];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <main className="relative isolate flex flex-col px-6 py-7 sm:px-10">
        <Aurora variant="subtle" />
        <Link href="/" aria-label="Frameflow home" className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>
        <p className="text-right text-xs text-muted-foreground/60">One line in. A finished motion video out.</p>
      </main>

      <aside className="relative isolate hidden overflow-hidden border-l border-white/[0.06] bg-[oklch(0.15_0.018_284)] p-12 lg:flex lg:flex-col lg:justify-center">
        <Aurora />
        <div className="mx-auto w-full max-w-xl">
          <h2 className="animate-fade-up text-4xl leading-[1.05] font-semibold tracking-[-0.035em] [animation-delay:120ms] xl:text-5xl">
            <span className="text-gradient">Motion design</span>
            <br />
            <span className="text-brand-gradient pr-1 font-serif font-normal tracking-normal italic">on autopilot.</span>
          </h2>
          <p className="mt-4 max-w-md animate-fade-up text-muted-foreground [animation-delay:200ms]">
            Describe a video in one line. Frameflow writes the script, records the voice, picks the music and animates every scene.
          </p>
          {/* a vertical ad in a phone, with a square one floating beside it */}
          <div className="relative mt-10 flex h-[26rem] animate-fade-up items-center justify-center [animation-delay:300ms]">
            <div className="shine-border relative h-full rounded-[2.2rem] bg-black p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] ring-1 ring-white/15">
              <video
                src={kettle.src}
                poster={kettle.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="aspect-[9/16] h-full rounded-[1.7rem] object-cover"
              />
              <span className="absolute top-3.5 left-1/2 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />
            </div>
            <div className="glass absolute right-0 bottom-6 w-44 animate-float rounded-2xl border border-white/10 p-1.5 xl:right-6">
              <video
                src={pulsefit.src}
                poster={pulsefit.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="aspect-square w-full rounded-xl object-cover"
              />
              <div className="px-1.5 pt-2 pb-1 text-[11px] text-muted-foreground">
                {pulsefit.brand} · {pulsefit.format}
              </div>
            </div>
            <div className="glass absolute top-8 left-0 animate-float rounded-xl border border-white/10 px-3 py-2 text-xs [animation-delay:-3s] xl:left-6">
              <div className="font-medium">{kettle.brand}</div>
              <div className="text-muted-foreground">
                {kettle.format} · {kettle.voice}
              </div>
            </div>
          </div>
          <ul className="mt-8 grid animate-fade-up grid-cols-2 gap-3 text-sm [animation-delay:420ms]">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-foreground/85">
                <span className="flex size-5 items-center justify-center rounded-full bg-[oklch(0.8_0.13_205/0.15)] ring-1 ring-[oklch(0.8_0.13_205/0.3)]">
                  <Check className="size-3 text-[oklch(0.85_0.1_205)]" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[11px] text-muted-foreground/60">
            Example brands, rendered by Frameflow. <MusicCredit demos={[kettle, pulsefit]} />
          </p>
        </div>
      </aside>
    </div>
  );
}
