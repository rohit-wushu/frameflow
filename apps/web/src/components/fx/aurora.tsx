import { cn } from "@/lib/utils";

// Ambient background: drifting violet/cyan light, a fading grid and film grain.
// "hero" is the full landing-page version; "subtle" sits behind app screens.
export function Aurora({ variant = "hero", className }: { variant?: "hero" | "subtle"; className?: string }) {
  const hero = variant === "hero";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className={cn("absolute inset-0 bg-grid fade-mask-top", hero ? "opacity-100" : "opacity-60")} />
      <div
        className={cn(
          "absolute -top-[30%] left-[8%] aspect-square w-[55%] animate-aurora rounded-full blur-[110px]",
          hero ? "bg-[oklch(0.55_0.24_290/0.45)]" : "bg-[oklch(0.55_0.24_290/0.22)]",
        )}
      />
      <div
        className={cn(
          "absolute -top-[18%] right-[4%] aspect-square w-[42%] animate-aurora rounded-full blur-[120px] [animation-delay:-6s] [animation-duration:22s]",
          hero ? "bg-[oklch(0.75_0.13_205/0.28)]" : "bg-[oklch(0.75_0.13_205/0.12)]",
        )}
      />
      {hero && (
        <>
          <div className="absolute top-[22%] left-[38%] aspect-square w-[30%] animate-aurora rounded-full bg-[oklch(0.6_0.22_320/0.18)] blur-[120px] [animation-delay:-11s] [animation-duration:26s]" />
          {/* a soft beam of light falling from the top center */}
          <div className="absolute -top-40 left-1/2 h-[42rem] w-[60rem] -translate-x-1/2 bg-[conic-gradient(from_180deg_at_50%_0%,transparent_155deg,oklch(0.8_0.12_292/0.16)_180deg,transparent_205deg)]" />
        </>
      )}
      <div className="absolute inset-0 bg-noise opacity-[0.035] mix-blend-overlay" />
    </div>
  );
}
