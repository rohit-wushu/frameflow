"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// A big statement whose words light up one by one as it scrolls through the screen.
const TEXT = "Frameflow writes the script, records the voice, picks the music, designs every scene and cuts it all on the beat. All you write is one line.";
const WORDS = TEXT.split(" ");
const ACCENT_FROM = WORDS.length - 2; // "one line."

export function KineticBand() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLit(WORDS.length);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // starts when the paragraph's top reaches 85% of the screen, done when its bottom reaches 45%
      const p = (vh * 0.85 - r.top) / (vh * 0.4 + r.height);
      setLit(Math.round(Math.min(1, Math.max(0, p)) * WORDS.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="relative px-4 py-28 sm:px-6 sm:py-40">
      <div aria-hidden className="absolute inset-x-0 top-1/2 -z-10 mx-auto h-72 max-w-3xl -translate-y-1/2 rounded-full bg-[oklch(0.55_0.24_290/0.14)] blur-[120px]" />
      <p ref={ref} className="mx-auto max-w-5xl text-[2rem] leading-[1.15] font-bold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl">
        {WORDS.map((w, i) => (
          <span
            key={i}
            className={cn(
              "transition-colors duration-500",
              i >= ACCENT_FROM ? (i < lit ? "text-brand-gradient" : "text-white/12") : i < lit ? "text-foreground" : "text-white/12",
            )}
          >
            {w}{" "}
          </span>
        ))}
      </p>
    </section>
  );
}
