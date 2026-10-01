import { db, effectiveTier, usageFor } from "@frameflow/db";
import { CreditCard, LogOut, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { LogoMark } from "@/components/brand/logo";
import { Aurora } from "@/components/fx/aurora";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VerifyBanner } from "@/components/verify-banner";
import { isAdmin, requireUser } from "@/lib/auth";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const usage = await usageFor(db(), user);
  // free accounts count videos; Pro counts renders
  const [count, limit, what] = usage.videosLimit !== null ? [usage.videos, usage.videosLimit, "videos"] : [usage.renders, usage.rendersLimit, "renders"];
  const used = Math.min(100, Math.round((count / Math.max(1, limit)) * 100));
  return (
    <div className="relative isolate min-h-dvh">
      <Aurora variant="subtle" className="fixed h-[38rem] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]" />
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <LogoMark className="size-6" />
            <span className="hidden sm:inline">Frameflow</span>
          </Link>
          <span className="hidden h-5 w-px bg-white/10 sm:block" />
          <AppNav />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden w-36 space-y-1 md:block" title={`Resets ${usage.resetsOn.toISOString().slice(0, 10)}`}>
              <span className="block text-right text-[11px] text-muted-foreground">
                {count}/{limit} {what} this month
              </span>
              <span className="block h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--brand-violet),var(--brand-teal))]" style={{ width: `${used}%` }} />
              </span>
            </div>
            <Button asChild size="sm" className="h-8 px-3">
              <Link href="/new">
                <Plus />
                New video
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 max-w-44 gap-2 pr-2.5 pl-1">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-teal))] text-[10px] font-semibold text-white"
                  >
                    {initials(user.name)}
                  </span>
                  <span className="truncate max-sm:sr-only">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Plan: {effectiveTier(user)} · {usage.aiCalls}/{usage.aiCallsLimit} AI requests today
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/billing">
                    <CreditCard />
                    Billing
                  </Link>
                </DropdownMenuItem>
                {isAdmin(user) && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield />
                      Admin panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <form action={logout}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut />
                      Log out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {!user.emailVerifiedAt && <VerifyBanner email={user.email} />}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
