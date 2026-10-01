"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Videos" },
  { href: "/brands", label: "Brand kits" },
  { href: "/batch", label: "Batch" },
];

// "Videos" also covers a project's pages and the new-video form.
const isActive = (href: string, path: string) =>
  href === "/" ? path === "/" || path === "/new" || path.startsWith("/p/") : path === href || path.startsWith(`${href}/`);

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="flex min-w-0 items-center gap-0.5 text-sm">
      {ITEMS.map((item) => {
        const active = isActive(item.href, path);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-lg px-2 py-1.5 whitespace-nowrap transition-colors sm:px-3",
              active ? "bg-white/[0.07] text-foreground ring-1 ring-white/[0.08]" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            {item.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-[11px] h-px bg-[linear-gradient(90deg,transparent,var(--brand-violet),var(--brand-teal),transparent)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
