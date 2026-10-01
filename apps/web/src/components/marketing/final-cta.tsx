import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Reveal } from "@/components/fx/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Accent } from "./section-heading";
import { SHOWCASE } from "./showcase-data";

// Stills from the showcase renders, floating around the card's corners (wide screens only).
const TILES = [
  { demo: SHOWCASE.ledgerly, className: "-top-10 -left-16 w-56 -rotate-[8deg]", delay: "0s" },
  { demo: SHOWCASE.pulsefit, className: "-top-12 -right-12 w-36 rotate-[7deg]", delay: "-2s" },
  { demo: SHOWCASE.kettle, className: "-bottom-16 -left-8 w-28 rotate-[6deg]", delay: "-4s" },
  { demo: SHOWCASE.clearsight, className: "-right-20 -bottom-10 w-52 -rotate-[6deg]", delay: "-3s" },
];

export function FinalCta() {
  return (
    <section className="px-4 pt-16 pb-36 sm:px-6">
      <Reveal className="relative mx-auto max-w-5xl">
        {TILES.map(({ demo, className, delay }) => (
          <div
            key={demo.brand}
            aria-hidden
            className={cn("absolute z-20 hidden animate-float rounded-2xl bg-black/40 p-1.5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/15 backdrop-blur-md lg:block", className)}
            style={{ animationDelay: delay }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={demo.poster}
              alt=""
              className={cn("w-full rounded-xl object-cover", demo.format === "9:16" ? "aspect-[9/16]" : demo.format === "1:1" ? "aspect-square" : "aspect-video")}
            />
          </div>
        ))}
        <div className="shine-border relative isolate overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[oklch(0.15_0.02_285)] px-6 py-24 text-center sm:px-12">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute -top-1/2 left-1/2 aspect-square w-[80%] -translate-x-1/2 animate-aurora rounded-full bg-[oklch(0.55_0.24_290/0.45)] blur-[100px]" />
            <div className="absolute -bottom-1/2 left-[15%] aspect-square w-1/2 animate-aurora rounded-full bg-[oklch(0.75_0.13_205/0.25)] blur-[100px] [animation-delay:-8s]" />
            <div className="absolute -right-[10%] -bottom-1/3 aspect-square w-[40%] animate-aurora rounded-full bg-[oklch(0.7_0.2_340/0.18)] blur-[100px] [animation-delay:-14s]" />
            <div className="absolute inset-0 bg-grid fade-mask-top opacity-70" />
          </div>
          <LogoMark className="mx-auto size-12 animate-float" />
          <h2 className="mx-auto mt-8 max-w-2xl text-4xl font-bold tracking-[-0.035em] text-balance sm:text-6xl">
            <span className="text-gradient">Your next video is </span>
            <Accent>one line</Accent>
            <span className="text-gradient"> away.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">Describe it, check the storyboard, download the MP4.</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="group h-11 px-6 text-[0.95rem]">
              <Link href="/signup">
                Start free
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6 text-[0.95rem]">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
