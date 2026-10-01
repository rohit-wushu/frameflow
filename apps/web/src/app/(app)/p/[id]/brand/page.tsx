import type { Brand } from "@frameflow/scene-schema";
import { redirect } from "next/navigation";
import { BrandForm } from "@/components/brand-form";
import { Waiting } from "@/components/waiting";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { catalog } from "@/lib/catalog";
import { ownProject, projectHref } from "@/lib/data";

export const metadata = { title: "Brand check" };

interface Research {
  url: string;
  brand: Brand;
  description: string;
  screenshot: string;
  notes: string[];
  detected: { headingFont: string; bodyFont: string };
}

const DEFAULT_BRAND: Brand = {
  name: "",
  colors: { primary: "#7C5CFF", secondary: "#22D3EE", background: "#0B0B14", text: "#F5F5FA" },
  font: { heading: "Space Grotesk", body: "Inter" },
};

export default async function BrandPage({ params }: PageProps<"/p/[id]/brand">) {
  const { id } = await params;
  const { project } = await ownProject(id);
  if (project.status === "researching") {
    return <Waiting projectId={id} status={project.status} title="Reading your website…" hint="Logo, colors, fonts and the facts on the page. Up to a minute." />;
  }
  if (project.status !== "brand") redirect(projectHref(project));
  const research = project.research as Research | null;
  const initial = (project.brand as Brand | null) ?? research?.brand ?? DEFAULT_BRAND;
  const fonts = [...new Set([initial.font.heading, initial.font.body, ...catalog.fonts])];
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Step 2 of 5</p>
        <h1 className="text-3xl font-semibold tracking-tight">Check the brand</h1>
        <p className="text-muted-foreground">
          {research ? `Found on ${new URL(research.url).hostname}. ` : ""}Fix anything that is off; every scene uses these colors, fonts and logo.
        </p>
      </div>
      {project.error && (
        <Alert variant="destructive">
          <AlertDescription>{project.error}</AlertDescription>
        </Alert>
      )}
      <BrandForm projectId={id} initial={initial} logoKey={initial.logoUrl ?? project.logoKey} fonts={fonts} />
      {research && (
        <div className="grid gap-6 border-t pt-8 md:grid-cols-[320px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${research.screenshot}`} alt="Website screenshot" className="rounded-lg border" />
          <div className="space-y-2 text-sm text-muted-foreground">
            {research.description && <p>{research.description}</p>}
            <p>
              Fonts on the site: {research.detected.headingFont.split(",")[0]} / {research.detected.bodyFont.split(",")[0]}
            </p>
            {research.notes.map((n) => (
              <p key={n}>· {n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
