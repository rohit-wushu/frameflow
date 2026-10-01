import { CountUp } from "@/components/fx/count-up";
import { Reveal } from "@/components/fx/reveal";

// Facts about the engine (packages/templates, the director's voice list, packages/timing).
const STATS = [
  { value: 12, suffix: "", label: "scene templates" },
  { value: 8, suffix: "", label: "natural voices" },
  { value: 3, suffix: "", label: "formats from one plan" },
  { value: 250, prefix: "±", suffix: " ms", label: "to land every cut on a beat" },
];

export function StatsBand() {
  return (
    <section className="px-4 py-10 sm:px-6">
      <Reveal className="mx-auto grid max-w-6xl grid-cols-2 overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02] lg:grid-cols-4">
        {STATS.map((s, i) => (
          <div key={s.label} className={`relative px-6 py-10 text-center ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""} border-white/[0.07]`}>
            <div className="text-gradient text-4xl font-bold tracking-tight sm:text-5xl">
              {s.prefix}
              <CountUp to={s.value} />
              {s.suffix}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
