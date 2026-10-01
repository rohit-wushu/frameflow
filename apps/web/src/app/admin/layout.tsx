import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoMark } from "@/components/brand/logo";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: { default: "Admin", template: "%s · Admin · Frameflow" } };

// Admin panel: users, payments, videos, jobs and the activity log. Only admins get past requireAdmin (others see 404).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <LogoMark className="size-6" />
            Frameflow
          </Link>
          <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-400/25">
            <Shield className="size-3" />
            Admin
          </span>
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{admin.email}</span>
            <Link href="/" className="flex items-center gap-1.5 hover:text-foreground">
              <ArrowLeft className="size-3.5" />
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[13rem_1fr] md:py-8">
        <aside className="md:sticky md:top-20 md:self-start">
          <AdminNav />
        </aside>
        <main className="min-w-0 space-y-8">{children}</main>
      </div>
    </div>
  );
}
