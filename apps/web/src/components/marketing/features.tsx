import { AudioWaveform, Captions, MessageSquareText, Palette, Ratio, SlidersHorizontal, Waves } from "lucide-react";
import { Reveal } from "@/components/fx/reveal";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { cn } from "@/lib/utils";
import { BeatVisual, BrandVisual, CaptionsVisual, ChatVisual, FormatsVisual, MixVisual, SfxVisual } from "./feature-visuals";
import { Accent, SectionHeading } from "./section-heading";

// Each card has its own accent: an icon tile, a glow in the top corner and a line along the top edge.
const CARDS = [
  {
    span: "lg:col-span-4",
    accent: "#8B6CFF",
    icon: AudioWaveform,
    title: "Cuts that land on the beat",
    text: "Every scene change snaps to the music within a quarter second, and never before the last word is said.",
    visual: <BeatVisual />,
  },
  {
    span: "lg:col-span-2",
    accent: "#22D3EE",
    icon: Palette,
    title: "Your brand, not a template's",
    text: "Colors, fonts and logo come from your website and run through every scene.",
    visual: <BrandVisual />,
  },
  {
    span: "lg:col-span-2",
    accent: "#F472B6",
    icon: SlidersHorizontal,
    title: "A studio-grade mix",
    text: "Voice levelled, music ducked under speech, the whole mix mastered to −14 LUFS.",
    visual: <MixVisual />,
  },
  {
    span: "lg:col-span-2",
    accent: "#F59E0B",
    icon: MessageSquareText,
    title: "Edit by chatting",
    text: "Ask for a calmer track or a shorter headline and get a new version. Every version is kept.",
    visual: <ChatVisual />,
  },
  {
    span: "lg:col-span-2",
    accent: "#34D399",
    icon: Ratio,
    title: "Every format, natively",
    text: "Landscape, vertical and square, with layouts that adapt instead of cropping.",
    visual: <FormatsVisual />,
  },
  {
    span: "lg:col-span-3",
    accent: "#60A5FA",
    icon: Captions,
    title: "Word-by-word captions",
    text: "Timed to the voice, burned in or exported as .srt and .vtt.",
    visual: <CaptionsVisual />,
  },
  {
    span: "lg:col-span-3",
    accent: "#FB7185",
    icon: Waves,
    title: "Sound design included",
    text: "A whoosh on every cut, a pop for each list item and an impact on your logo, each timed to its peak.",
    visual: <SfxVisual />,
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div aria-hidden className="absolute inset-x-0 top-40 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-[oklch(0.55_0.24_290/0.16)] blur-[120px]" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              <span className="text-gradient">Everything a motion designer does.</span>
              <br />
              <Accent>Automatically.</Accent>
            </>
          }
        >
          Script, voice, music, sound design, animation and the final mix. Frameflow handles the craft so you can focus on the message.
        </SectionHeading>

        <div className="mt-16 grid gap-4 lg:grid-cols-6">
          {CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title} delay={(i % 3) * 90} className={cn(c.span)}>
                <SpotlightCard className="glass relative h-full overflow-hidden rounded-2xl border border-white/[0.07] p-6 sm:p-7">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full opacity-25 blur-[70px]"
                    style={{ background: c.accent }}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }}
                  />
                  <span
                    className="relative flex size-10 items-center justify-center rounded-xl ring-1 ring-white/15"
                    style={{ background: `linear-gradient(135deg, ${c.accent}55, ${c.accent}18)`, boxShadow: `0 10px 30px -12px ${c.accent}` }}
                  >
                    <Icon className="size-[1.1rem] text-white" />
                  </span>
                  <h3 className="relative mt-5 text-lg font-bold tracking-tight">{c.title}</h3>
                  <p className="relative mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{c.text}</p>
                  <div className="relative">{c.visual}</div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
