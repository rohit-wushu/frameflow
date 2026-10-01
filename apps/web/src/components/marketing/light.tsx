import { cn } from "@/lib/utils";

// The light bands of the landing page: an off-white slab with rounded corners, a fading dot grid
// and two soft violet/cyan glows, inset a little from the viewport edges.
export function LightSection({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("relative z-10 px-2 sm:px-3", className)}>
      {/* overflow-clip, not hidden: hidden would turn this into a scroll box and break the sticky story window */}
      <div className="relative isolate overflow-clip rounded-[2rem] bg-[#F6F6F3] py-24 text-neutral-900 sm:rounded-[2.75rem] sm:py-32">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(rgb(0_0_0/0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
        <div aria-hidden className="absolute -top-40 -left-20 -z-10 size-[36rem] rounded-full bg-[#8B6CFF]/20 blur-[120px]" />
        <div aria-hidden className="absolute -top-20 -right-32 -z-10 size-[30rem] rounded-full bg-[#22D3EE]/20 blur-[120px]" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
      </div>
    </section>
  );
}

export function LightEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold tracking-wide text-neutral-600 ring-1 ring-black/[0.06]">
      <span className="size-1.5 rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-teal))]" />
      {children}
    </div>
  );
}

// A headline accent for light backgrounds: serif italic with a deeper violet→cyan gradient.
export function LightAccent({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-[linear-gradient(100deg,#6D4BFF,#9B5CF6_45%,#0891B2)] bg-clip-text pr-1 font-serif font-normal tracking-normal text-transparent italic">
      {children}
    </span>
  );
}
