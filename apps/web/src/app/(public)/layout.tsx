import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/marketing/site-footer";

// Plain pages anyone can open: terms, privacy, refunds, contact, and the email-confirmed screen.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/" aria-label="Frameflow home">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
