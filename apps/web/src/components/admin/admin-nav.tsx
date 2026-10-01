"use client";
import { Activity, Clapperboard, CreditCard, LayoutDashboard, ListChecks, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/projects", label: "Videos", icon: Clapperboard },
  { href: "/admin/jobs", label: "Jobs", icon: ListChecks },
  { href: "/admin/activity", label: "Activity log", icon: Activity },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm md:flex-col">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 whitespace-nowrap transition-colors",
              active ? "bg-white/[0.07] text-foreground ring-1 ring-white/[0.08]" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
