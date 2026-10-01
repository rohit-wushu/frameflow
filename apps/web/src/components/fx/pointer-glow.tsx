"use client";
import { useEffect, useRef } from "react";

// A soft light that follows the pointer across its parent section (fine pointers only).
export function PointerGlow({ color = "oklch(0.7 0.18 292 / 0.16)", size = 640 }: { color?: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.style.opacity = "1";
          el.style.background = `radial-gradient(${size}px circle at ${x}px ${y}px, ${color}, transparent 60%)`;
        });
    };
    const leave = () => (el.style.opacity = "0");
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    return () => {
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [color, size]);
  return <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500" />;
}
