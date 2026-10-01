import { cn } from "@/lib/utils";

// The Frameflow mark: a play glyph with speed lines on a violet→cyan tile.
// Every instance renders identical gradient defs, so the shared ids are harmless.
// `animated` (landing nav): the tile pops in, then keeps moving: it floats and glows, the speed lines
// stream backwards, the play glyph pushes forward, and a shine sweeps across. Keyframes are in globals.css.
export function LogoMark({ className, animated }: { className?: string; animated?: boolean }) {
  const a = (cls: string) => (animated ? cls : undefined);
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0 overflow-visible", a("animate-[logo-pop_0.9s_cubic-bezier(0.34,1.56,0.64,1)_both,logo-bob_3s_ease-in-out_0.9s_infinite,logo-glow_3s_ease-in-out_0.9s_infinite]"), className)}>
      <defs>
        <linearGradient id="ff-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B6CFF" />
          <stop offset="0.55" stopColor="#6D4BFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="ff-shine" x1="16" y1="0" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ff-tile">
          <rect width="32" height="32" rx="9" />
        </clipPath>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ff-mark)" />
      <rect width="32" height="32" rx="9" fill="url(#ff-shine)" />
      {animated && (
        <g clipPath="url(#ff-tile)">
          <g transform="rotate(20 16 16)">
            <rect x="-14" y="-10" width="7" height="52" fill="#fff" opacity="0.35" className="animate-[logo-shine_4.5s_ease-in-out_1.2s_infinite]" />
          </g>
        </g>
      )}
      <rect x="5.5" y="12" width="5" height="2" rx="1" fill="#fff" opacity="0.55" className={a("animate-[logo-streak_1.6s_ease-in-out_infinite]")} />
      <rect x="3.5" y="15" width="7" height="2" rx="1" fill="#fff" opacity="0.85" className={a("animate-[logo-streak_1.6s_ease-in-out_0.18s_infinite]")} />
      <rect x="5.5" y="18" width="5" height="2" rx="1" fill="#fff" opacity="0.55" className={a("animate-[logo-streak_1.6s_ease-in-out_0.36s_infinite]")} />
      <path
        d="M13.5 10.6v10.8a1 1 0 0 0 1.5.86l9.3-5.4a1 1 0 0 0 0-1.72L15 9.74a1 1 0 0 0-1.5.86Z"
        fill="#fff"
        className={a("origin-center animate-[logo-play_1.6s_cubic-bezier(0.34,1.56,0.64,1)_infinite] [transform-box:fill-box]")}
      />
    </svg>
  );
}

export function Logo({ className, animated }: { className?: string; animated?: boolean }) {
  return (
    <span className={cn("group/logo inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <LogoMark
        animated={animated}
        className={cn(animated && "transition-transform duration-500 group-hover/logo:scale-110 group-hover/logo:-rotate-6")}
      />
      {animated ? (
        // letters rise in one by one; the word takes the brand violet on hover
        <span className="flex transition-colors duration-300 group-hover/logo:text-[oklch(0.84_0.11_292)]">
          {"Frameflow".split("").map((ch, i) => (
            <span key={i} className="inline-block animate-fade-up" style={{ animationDelay: `${250 + i * 45}ms` }}>
              {ch}
            </span>
          ))}
        </span>
      ) : (
        <span>Frameflow</span>
      )}
    </span>
  );
}
