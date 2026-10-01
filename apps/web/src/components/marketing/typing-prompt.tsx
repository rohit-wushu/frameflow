"use client";
import { useEffect, useState } from "react";

const PROMPTS = [
  "A 30-second launch video for our invoicing app",
  "Explain how our API works in 20 seconds",
  "A vertical ad for the summer sale, upbeat",
  "Announce our new dashboard to existing customers",
  "A calm product demo for a meditation app",
];

// Types, holds, deletes and moves on to the next example prompt.
export function TypingPrompt() {
  const [text, setText] = useState(PROMPTS[0]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let n = PROMPTS[0].length;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const full = PROMPTS[i];
      if (!deleting && n === full.length) {
        deleting = true;
        timer = setTimeout(step, 2200);
        return;
      }
      if (deleting && n === 0) {
        deleting = false;
        i = (i + 1) % PROMPTS.length;
        timer = setTimeout(step, 350);
        return;
      }
      n += deleting ? -1 : 1;
      setText(PROMPTS[i].slice(0, n));
      timer = setTimeout(step, deleting ? 18 : 38 + Math.random() * 40);
    };
    timer = setTimeout(step, 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className="truncate">
      {text}
      <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-caret bg-primary" />
    </span>
  );
}
