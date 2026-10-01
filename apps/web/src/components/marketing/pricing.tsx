import { Check } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/fx/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Accent, SectionHeading } from "./section-heading";

type Limits = { videosPerMonth: number | null; rendersPerMonth: number; aiCallsPerDay: number };

// Plan limits come from packages/db (limitsFor) and the Pro price from lib/site (proOffer), so this page
// always matches what the app enforces and charges.
export function Pricing({ free, pro, offer }: { free: Limits; pro: Limits; offer: { priceInr: number; days: number } }) {
  const plans = [
    {
      name: "Free",
      price: "₹0",
      per: "/ month",
      note: "No card needed",
      cta: { label: "Start free", href: "/signup" },
      featured: false,
      items: [
        `${free.videosPerMonth} videos a month, with edits`,
        "Try every voice and style (watermarked preview)",
        `${free.aiCallsPerDay} AI director requests a day`,
        "16:9, 9:16 and 1:1, 15 to 90 seconds",
        "Brand kits from your website",
        "Captions as .srt and .vtt",
      ],
    },
    {
      name: "Pro",
      price: `₹${offer.priceInr.toLocaleString("en-IN")}`,
      per: offer.days === 30 ? "/ month" : `/ ${offer.days} days`,
      note: "For teams that ship every week. No auto-renewal.",
      cta: { label: "Start free, upgrade anytime", href: "/signup" },
      featured: true,
      items: [
        `${pro.videosPerMonth === null ? "Unlimited videos" : `${pro.videosPerMonth} videos a month`}, up to ${pro.rendersPerMonth} renders`,
        "Premium natural voices in 20+ Indian languages",
        "Voice styles, speed and a voice per scene",
        `${pro.aiCallsPerDay} AI director requests a day`,
        "Everything in Free",
        "Pay by UPI, card or netbanking",
      ],
    },
  ];

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pricing"
          title={
            <>
              <span className="text-gradient">Start </span>
              <Accent>free.</Accent>
              <span className="text-gradient"> Grow when you need to.</span>
            </>
          }
        />
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 md:grid-cols-2">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 120}>
              <div
                className={cn(
                  "glass relative flex h-full flex-col rounded-3xl border border-white/[0.07] p-8",
                  p.featured && "shine-border bg-[linear-gradient(160deg,color-mix(in_oklch,var(--brand-violet),transparent_86%),transparent_55%)]",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.featured && (
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-[oklch(0.85_0.1_292)] ring-1 ring-primary/30">
                      Popular
                    </span>
                  )}
                </div>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.per}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>
                <ul className="mt-8 flex-1 space-y-3 text-sm">
                  {p.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[oklch(0.8_0.13_205/0.15)] ring-1 ring-[oklch(0.8_0.13_205/0.3)]">
                        <Check className="size-3 text-[oklch(0.85_0.1_205)]" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" variant={p.featured ? "default" : "outline"} className="mt-8 w-full">
                  <Link href={p.cta.href}>{p.cta.label}</Link>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
