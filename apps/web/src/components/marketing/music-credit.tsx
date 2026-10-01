import { cn } from "@/lib/utils";
import type { Showcase } from "./showcase-data";

// CC BY 4.0 attribution for the music in the given videos (titles from each render's credits.txt).
// Show it wherever those videos play.
export function MusicCredit({ demos, className }: { demos: Showcase[]; className?: string }) {
  const titles = [...new Set(demos.map((d) => d.music.track))].map((t) => `“${t}”`);
  const list = titles.length > 1 ? `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}` : titles[0];
  return (
    <span className={cn(className)}>
      Music: {list} by Kevin MacLeod (
      <a href="https://incompetech.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
        incompetech.com
      </a>
      ), licensed under{" "}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
        CC BY 4.0
      </a>
      .
    </span>
  );
}
