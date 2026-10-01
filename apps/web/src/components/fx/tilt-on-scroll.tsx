"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Starts tilted back in 3D and straightens out as the page scrolls (the hero product shot).
export function TiltOnScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = "none";
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top;
      // fully flat once the frame's top reaches 15% of the viewport height
      const p = Math.min(1, Math.max(0, 1 - (top - window.innerHeight * 0.15) / (window.innerHeight * 0.6)));
      el.style.transform = `perspective(1400px) rotateX(${(1 - p) * 22}deg) scale(${0.9 + 0.1 * p}) translateY(${(1 - p) * -10}px)`;
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
    <div ref={ref} className={cn("origin-top will-change-transform", className)} style={{ transform: "perspective(1400px) rotateX(22deg) scale(0.9)" }}>
      {children}
    </div>
  );
}
