import { AutoVideo } from "@/components/fx/auto-video";
import { Reveal } from "@/components/fx/reveal";
import { cn } from "@/lib/utils";
import { HowItWorksStory } from "./how-it-works-story";
import { LightAccent, LightEyebrow as Eyebrow, LightSection } from "./light";
import { MusicCredit } from "./music-credit";
import { SHOWCASE, type Showcase } from "./showcase-data";

// The light band in the middle of the landing page: four example brands rendered by the engine,
// then the four steps of how it works.

const ASPECT = { "16:9": "aspect-video", "9:16": "aspect-[9/16]", "1:1": "aspect-square" } as const;

function ShowcaseCard({ demo, className, delay = 0, details }: { demo: Showcase; className?: string; delay?: number; details?: boolean }) {
  return (
    <Reveal delay={delay} className={className}>
      <figure className="group flex h-full flex-col rounded-[1.4rem] bg-white p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_30px_60px_-32px_rgb(30_20_60/0.3)] ring-1 ring-black/[0.06] transition duration-500 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_40px_80px_-30px_rgb(60_40_140/0.35)]">
        <div className={cn("relative overflow-hidden rounded-[1rem]", ASPECT[demo.format])} style={{ background: demo.background }}>
          <AutoVideo src={demo.src} poster={demo.poster} className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.02]" />
          <span className="absolute top-2.5 left-2.5 rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[10px] text-white/90 ring-1 ring-white/15 backdrop-blur-md">
            {demo.format} · {Math.round(demo.duration)} s
          </span>
        </div>
        <figcaption className="flex flex-1 flex-col px-2 pt-3 pb-1.5">
          <div className="flex items-center gap-2.5">
            <span className="flex -space-x-1">
              {demo.colors.slice(0, 2).map((c) => (
                <span key={c} className="size-4 rounded-full ring-2 ring-white" style={{ background: c }} />
              ))}
            </span>
            <span className="font-semibold text-neutral-900">{demo.brand}</span>
            <span className="ml-auto truncate text-xs text-neutral-500">{demo.font}</span>
          </div>
          {details && (
            <dl className="mt-5 grid flex-1 grid-cols-2 content-end gap-x-4 gap-y-3 border-t border-black/[0.06] pt-4 text-xs">
              {[
                ["Voice", demo.voice],
                ["Music", `${demo.music.track}, ${Math.round(demo.music.bpm)} BPM`],
                ["Cuts on the beat", `${demo.cutsOnBeat} of ${demo.cuts}`],
                ["Loudness", `${demo.loudness} LUFS`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="mt-0.5 font-medium text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </figcaption>
      </figure>
    </Reveal>
  );
}


export function Showcase() {
  const { ledgerly, kettle, pulsefit, clearsight } = SHOWCASE;
  return (
    <LightSection id="showcase">
      <Reveal className="mx-auto max-w-3xl text-center">
        <Eyebrow>Made with Frameflow</Eyebrow>
        <h2 className="mt-5 text-4xl font-bold tracking-[-0.035em] text-balance text-neutral-950 sm:text-6xl">
          One engine. <LightAccent>Every brand.</LightAccent>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-pretty text-neutral-600 sm:text-lg">
          Four example brands, four different looks, three formats. Each one gets its own colors, fonts, voice and music, with every
          cut on the beat.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <ShowcaseCard demo={ledgerly} />
          <div className="flex flex-col gap-5 sm:flex-row">
            <ShowcaseCard demo={pulsefit} delay={120} className="sm:flex-[1]" />
            <ShowcaseCard demo={clearsight} delay={200} className="sm:flex-[1.78]" />
          </div>
        </div>
        <ShowcaseCard demo={kettle} delay={160} details className="lg:col-span-4" />
      </div>
      <p className="mt-6 text-center text-xs text-neutral-500">
        Example brands, rendered by the Frameflow engine. <MusicCredit demos={[ledgerly, pulsefit, clearsight, kettle]} />
      </p>

      {/* how it works */}
      <div id="how" className="mt-32 scroll-mt-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.035em] text-balance text-neutral-950 sm:text-5xl">
            From one line to the <LightAccent>final cut</LightAccent>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-600 sm:text-lg">The production pipeline of a motion studio, without the studio.</p>
        </Reveal>
        <HowItWorksStory />
      </div>
    </LightSection>
  );
}
