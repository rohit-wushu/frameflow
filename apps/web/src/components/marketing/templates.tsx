import { AutoVideo } from "@/components/fx/auto-video";
import { Reveal } from "@/components/fx/reveal";
import { cn } from "@/lib/utils";
import { LightAccent, LightEyebrow, LightSection } from "./light";
import { SHOWCASE } from "./showcase-data";

// Each tile is one scene cut out of a showcase render, so every template shows a different brand.
const PICKS = [
  { key: "ledgerly", scene: "product", text: "Your product on a laptop, browser or phone." },
  { key: "ledgerly", scene: "reminders", text: "Zooms into the part of the screen that matters." },
  { key: "clearsight", scene: "spotlight", text: "One feature up close." },
  { key: "pulsefit", scene: "compare", text: "The old way against yours." },
  { key: "clearsight", scene: "stat", text: "A number that counts up on the word." },
  { key: "pulsefit", scene: "hook", text: "Every word pops in on the voice." },
] as const;

const ALL = [
  "Hero text",
  "Kinetic words",
  "Problem list",
  "Feature grid",
  "Feature spotlight",
  "Stat counter",
  "Device mockup",
  "Screenshot zoom",
  "Comparison",
  "Testimonial",
  "Call to action",
  "Logo reveal",
];

export function Templates() {
  return (
    <LightSection id="templates" className="py-10">
      <Reveal className="mx-auto max-w-3xl text-center">
        <LightEyebrow>Templates</LightEyebrow>
        <h2 className="mt-5 text-4xl font-bold tracking-[-0.035em] text-balance text-neutral-950 sm:text-5xl">
          Scenes that move like a <LightAccent>studio</LightAccent> made them
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-pretty text-neutral-600 sm:text-lg">
          Twelve hand-built motion templates. The director picks one for every line of your script and dresses it in your brand.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PICKS.map((p, i) => {
          const demo = SHOWCASE[p.key];
          const scene = demo.scenes.find((s) => s.id === p.scene)!;
          return (
            <Reveal key={`${p.key}-${p.scene}`} delay={(i % 3) * 100}>
              <figure className="group h-full rounded-[1.4rem] bg-white p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_30px_60px_-32px_rgb(30_20_60/0.3)] ring-1 ring-black/[0.06] transition duration-500 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_40px_80px_-30px_rgb(60_40_140/0.35)]">
                <div className="relative aspect-video overflow-hidden rounded-[1rem]" style={{ background: demo.background }}>
                  <AutoVideo
                    src={scene.clip!}
                    poster={scene.clipPoster}
                    className={cn("absolute inset-0 size-full transition duration-700 group-hover:scale-[1.03]", demo.format === "16:9" ? "object-cover" : "object-contain")}
                  />
                  <span className="absolute top-2.5 right-2.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90 ring-1 ring-white/15 backdrop-blur-md">
                    {demo.brand} · {demo.format}
                  </span>
                </div>
                <figcaption className="px-2 pt-3.5 pb-1.5">
                  <div className="font-semibold text-neutral-900">{scene.label}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">{p.text}</div>
                </figcaption>
              </figure>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-10 flex flex-wrap justify-center gap-2">
        {ALL.map((name) => (
          <span key={name} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-black/[0.07]">
            {name}
          </span>
        ))}
      </Reveal>
    </LightSection>
  );
}
