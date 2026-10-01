"use client";
import { cn } from "@/lib/utils";

// A card whose border-light follows the pointer (the `spotlight` utility in globals.css).
export function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn("spotlight", className)}
    >
      {children}
    </div>
  );
}
