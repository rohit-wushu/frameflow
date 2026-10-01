import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MusicCredit } from "./music-credit";
import { SHOWCASE } from "./showcase-data";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">One line in. A finished motion video out.</p>
        </div>
        <div className="flex gap-14 text-sm">
          <div className="space-y-2.5">
            <div className="font-medium">Product</div>
            <a href="/#how" className="block text-muted-foreground transition hover:text-foreground">How it works</a>
            <a href="/#features" className="block text-muted-foreground transition hover:text-foreground">Features</a>
            <a href="/#pricing" className="block text-muted-foreground transition hover:text-foreground">Pricing</a>
          </div>
          <div className="space-y-2.5">
            <div className="font-medium">Account</div>
            <Link href="/login" className="block text-muted-foreground transition hover:text-foreground">Log in</Link>
            <Link href="/signup" className="block text-muted-foreground transition hover:text-foreground">Sign up</Link>
          </div>
          <div className="space-y-2.5">
            <div className="font-medium">Company</div>
            <Link href="/contact" className="block text-muted-foreground transition hover:text-foreground">Contact</Link>
            <Link href="/terms" className="block text-muted-foreground transition hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="block text-muted-foreground transition hover:text-foreground">Privacy</Link>
            <Link href="/refunds" className="block text-muted-foreground transition hover:text-foreground">Refunds</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-white/[0.06] px-4 py-6 text-xs text-muted-foreground/70 sm:px-6">
        © {new Date().getFullYear()} Frameflow. Demo videos: <MusicCredit demos={Object.values(SHOWCASE)} /> Sound effects: Kenney (CC0).
        Icons in videos: Tabler Icons (MIT).
      </div>
    </footer>
  );
}
