import { db } from "@frameflow/db";
import { Play, Plus } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { projectHref } from "@/lib/data";

export const metadata = { title: "Videos" };

const ago = (d: Date) => {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return d.toISOString().slice(0, 10);
};

const IDEAS = ["A 30-second launch video for our app", "Explain our product in 20 seconds", "A vertical ad for the summer sale"];

export default async function Dashboard() {
  const user = await requireUser();
  const projects = await db().project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 60 });
  if (!projects.length) {
    return (
      <div className="flex flex-col items-center py-16 text-center sm:py-24">
        <div aria-hidden className="relative mb-12 h-36 w-56 animate-fade-up">
          <div className="absolute inset-0 -rotate-[9deg] rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07]" />
          <div className="absolute inset-0 rotate-[6deg] rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08]" />
          <div className="glass shine-border absolute inset-0 flex animate-float items-center justify-center rounded-2xl">
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--brand-violet),transparent_70%),transparent_60%)]" />
            <LogoMark className="relative size-12" />
          </div>
        </div>
        <h1 className="text-gradient animate-fade-up text-4xl font-semibold tracking-[-0.03em] [animation-delay:80ms]">Make your first video</h1>
        <p className="mt-4 max-w-md animate-fade-up text-muted-foreground [animation-delay:140ms]">
          Describe it in one line and add your website. Frameflow writes the script, records the voice, picks music and cuts it all on the beat.
        </p>
        <Button asChild size="lg" className="mt-8 animate-fade-up px-5 [animation-delay:200ms]">
          <Link href="/new">
            <Plus />
            New video
          </Link>
        </Button>
        <div className="mt-12 animate-fade-up space-y-3 [animation-delay:280ms]">
          <div className="text-xs tracking-wide text-muted-foreground/70 uppercase">Ideas to start with</div>
          <div className="flex flex-wrap justify-center gap-2">
            {IDEAS.map((idea) => (
              <span key={idea} className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-sm text-foreground/75 ring-1 ring-white/[0.07]">
                “{idea}”
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div className="flex animate-fade-up items-end justify-between gap-4">
        <div>
          <h1 className="text-gradient text-3xl font-semibold tracking-[-0.03em]">Your videos</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {projects.length} {projects.length === 1 ? "video" : "videos"}, newest first
          </p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/new"
          className="group relative flex min-h-56 animate-fade-up flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.015] text-center transition duration-300 hover:border-primary/50 hover:bg-primary/[0.04]"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand-violet),transparent_55%),color-mix(in_oklch,var(--brand-teal),transparent_75%))] ring-1 ring-white/15 transition duration-300 group-hover:scale-110 group-hover:rotate-3">
            <Plus className="size-5 text-white" />
          </span>
          <span className="font-medium">Create a video</span>
          <span className="text-xs text-muted-foreground">Describe it in one line</span>
        </Link>
        {projects.map((p, i) => (
          <Link
            key={p.id}
            href={projectHref(p)}
            className="group glass relative block animate-fade-up overflow-hidden rounded-2xl border border-white/[0.07] p-1.5 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_24px_60px_-28px_color-mix(in_oklch,var(--brand-violet),transparent_30%)]"
            style={{ animationDelay: `${Math.min(i + 1, 12) * 45}ms` }}
          >
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[oklch(0.11_0.012_283)] ring-1 ring-white/[0.06]">
              {p.currentVersion ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/projects/${p.id}/v${p.currentVersion}/poster.jpg`}
                    alt=""
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.55),transparent_45%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                  <span className="absolute flex size-11 scale-75 items-center justify-center rounded-full bg-white/15 opacity-0 ring-1 ring-white/30 backdrop-blur-md transition duration-300 group-hover:scale-100 group-hover:opacity-100">
                    <Play className="size-4 translate-x-px fill-white text-white" />
                  </span>
                </>
              ) : (
                <>
                  <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,oklch(1_0_0/0.05)_50%,transparent_70%)] bg-[length:200%_100%]" />
                  <span className="relative flex flex-col items-center gap-2 text-xs text-muted-foreground">
                    <LogoMark className="size-7 opacity-50 grayscale" />
                    No video yet
                  </span>
                </>
              )}
              <span className="absolute top-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white/85 ring-1 ring-white/10 backdrop-blur-md">
                {p.format}
              </span>
            </div>
            <div className="space-y-2 px-2.5 pt-3 pb-2">
              <div className="line-clamp-1 font-medium">{p.title}</div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {p.format} · {p.durationSec}s · {ago(p.updatedAt)}
                </span>
                <StatusBadge status={p.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
