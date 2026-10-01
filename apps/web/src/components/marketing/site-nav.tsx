import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#templates", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav className="glass mx-auto flex h-16 max-w-6xl items-center gap-6 rounded-2xl border border-white/10 bg-[oklch(0.16_0.014_283/0.72)] pr-2 pl-3 sm:pr-2.5 sm:pl-4">
        <Link href="/" aria-label="Frameflow home">
          <Logo animated className="text-[1.05rem] font-extrabold tracking-[-0.02em] sm:text-[1.2rem] [&_svg]:size-7 sm:[&_svg]:size-8" />
        </Link>
        <div className="hidden items-center gap-1 text-[0.95rem] font-bold text-foreground/85 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 transition hover:bg-white/[0.06] hover:text-foreground">
              {l.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" className="h-9 px-2.5 text-sm font-bold sm:h-10 sm:px-3.5 sm:text-[0.95rem]">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="group h-9 px-3 text-sm font-bold sm:h-10 sm:px-4 sm:text-[0.95rem]">
            <Link href="/signup">
              Start free
              <ArrowRight className="transition-transform group-hover:translate-x-0.5 max-sm:hidden" />
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
