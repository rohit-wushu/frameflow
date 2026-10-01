import { Reveal } from "@/components/fx/reveal";

export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
        <span className="size-1.5 rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-teal))]" />
        {eyebrow}
      </div>
      <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">{children}</p>}
    </Reveal>
  );
}

// A headline accent: serif italic with the brand gradient.
export function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-brand-gradient pr-1 font-serif font-normal tracking-normal italic">{children}</span>;
}
