import { useId } from "react";
import { catalog, type VoiceInfo } from "@/lib/catalog";
import { cn } from "@/lib/utils";

// An illustrated avatar for a voice (not a photo of anyone): a face with long or short hair by the voice's gender,
// colors seeded from its id, and a badge with the first letter of its language in that language's script.
const SKIN = ["#8d5524", "#a86b3c", "#c68642", "#d6a06b", "#e0ac69", "#7a4a26"];
const HAIR = ["#1b1414", "#2b1d16", "#3b2a20", "#120d0d"];
const SHIRT = ["#f4f1ea", "#1f2937", "#7c3aed", "#0e7490", "#be185d", "#b45309"];

function seed(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

// first letter (grapheme) of the language's own name: த, हि-style glyph clusters stay whole
function glyph(lang: string): string {
  const native = catalog.languages.find((l) => l.code === lang)?.native ?? lang;
  if (lang === "en") return "En";
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return [...seg.segment(native)][0]?.segment ?? native.slice(0, 1);
}

export function VoiceAvatar({ voice, size = 40, className, badge = true }: { voice: VoiceInfo; size?: number; className?: string; badge?: boolean }) {
  const id = useId().replace(/:/g, "");
  const h = seed(voice.id);
  const hue = seed(voice.lang) % 360;
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const shirt = SHIRT[(h >> 5) % SHIRT.length];
  const g = voice.gender;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 48 48" width={size} height={size} className="size-full rounded-full ring-1 ring-white/15">
        <defs>
          <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${hue} 65% 58%)`} />
            <stop offset="1" stopColor={`hsl(${(hue + 50) % 360} 60% 38%)`} />
          </linearGradient>
          <clipPath id={`c${id}`}>
            <circle cx="24" cy="24" r="24" />
          </clipPath>
        </defs>
        <g clipPath={`url(#c${id})`}>
          <rect width="48" height="48" fill={`url(#bg${id})`} />
          {g === "female" && <path d="M12.5 23 C12 10 36 10 35.5 23 L37 41 C33 38 31.5 33 31 28 L17 28 C16.5 33 15 38 11 41 Z" fill={hair} />}
          <path d="M7 50 C7 38 15 33.5 24 33.5 C33 33.5 41 38 41 50 Z" fill={shirt} />
          <rect x="20.5" y="27" width="7" height="8" rx="3" fill={skin} />
          <ellipse cx="24" cy="21.5" rx="8.5" ry="9.5" fill={skin} />
          {g === "female" ? (
            <path d="M15 21 C15 12.5 33 12.5 33 21 C30 16.5 25 15.5 15 21 Z" fill={hair} />
          ) : g === "male" ? (
            <path d="M15.2 20 C14.5 11.5 33.5 11.5 32.8 20 C31 15.5 17 15.5 15.2 20 Z" fill={hair} />
          ) : (
            <path d="M14.8 22 C14 11 34 11 33.2 22 C32 25 31.5 19 29 17.5 C24 18.5 20 18 17.5 17.5 C16 19 16 25 14.8 22 Z" fill={hair} />
          )}
          <circle cx="20.8" cy="22" r="0.95" fill="#1a1110" />
          <circle cx="27.2" cy="22" r="0.95" fill="#1a1110" />
          <path d="M21.6 26 C23 27.1 25 27.1 26.4 26" stroke="#5a2d22" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      {badge && (
        <span
          className="absolute -right-1.5 -bottom-1 flex items-center justify-center rounded-full bg-background px-1 leading-none font-semibold text-foreground ring-1 ring-white/25"
          style={{ minWidth: Math.max(18, size * 0.48), height: Math.max(18, size * 0.48), fontSize: Math.max(11, size * 0.34) }}
        >
          {glyph(voice.lang)}
        </span>
      )}
    </span>
  );
}
