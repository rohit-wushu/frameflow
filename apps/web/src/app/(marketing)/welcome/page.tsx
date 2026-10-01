import { limitsFor } from "@frameflow/db";
import type { Metadata } from "next";
import { Features } from "@/components/marketing/features";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { KineticBand } from "@/components/marketing/kinetic-band";
import { Pricing } from "@/components/marketing/pricing";
import { Showcase } from "@/components/marketing/showcase";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { StatsBand } from "@/components/marketing/stats-band";
import { Templates } from "@/components/marketing/templates";
import { UseCaseMarquee } from "@/components/marketing/use-case-marquee";
import { proOffer } from "@/lib/site";

// The public landing page. Signed-out visitors to "/" are rewritten here by proxy.ts;
// it renders no user data.
export const metadata: Metadata = {
  title: { absolute: "Frameflow · One line in. A finished motion video out." },
  description:
    "Frameflow turns one line into a finished motion-graphics video: brand from your website, script, voiceover, music and every cut on the beat.",
};

export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      <SiteNav />
      <main>
        <Hero freeRenders={limitsFor("free").rendersPerMonth} />
        <UseCaseMarquee />
        <Showcase />
        <KineticBand />
        <Features />
        <StatsBand />
        <Templates />
        <Pricing free={limitsFor("free")} pro={limitsFor("pro")} offer={proOffer()} />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
