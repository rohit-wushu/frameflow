import { CalendarDays, Megaphone, MonitorPlay, Newspaper, Presentation, Rocket, ShoppingBag, Sparkles } from "lucide-react";

const USES = [
  { icon: Rocket, label: "Launch videos" },
  { icon: MonitorPlay, label: "Product demos" },
  { icon: Presentation, label: "Explainers" },
  { icon: Sparkles, label: "Feature announcements" },
  { icon: Megaphone, label: "Social ads" },
  { icon: Newspaper, label: "Changelog updates" },
  { icon: ShoppingBag, label: "Sale promos" },
  { icon: CalendarDays, label: "Event teasers" },
];

export function UseCaseMarquee() {
  return (
    <section aria-label="What you can make" className="border-y border-white/[0.06] bg-white/[0.015] py-6">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 sm:px-6">
        <span className="hidden shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:block">Made for</span>
        <div className="fade-mask-x relative flex-1 overflow-hidden">
          <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
            {[...USES, ...USES].map(({ icon: Icon, label }, i) => (
              <span
                key={i}
                aria-hidden={i >= USES.length}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2 text-sm whitespace-nowrap text-foreground/80 ring-1 ring-white/[0.07]"
              >
                <Icon className="size-4 text-primary" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
