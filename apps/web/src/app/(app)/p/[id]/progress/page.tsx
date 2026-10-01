import { db } from "@frameflow/db";
import { redirect } from "next/navigation";
import { RenderProgress } from "@/components/render-progress";
import { ownProject } from "@/lib/data";

export const metadata = { title: "Rendering" };

export default async function ProgressPage({ params }: PageProps<"/p/[id]/progress">) {
  const { id } = await params;
  const { project } = await ownProject(id);
  const latest = await db().version.findFirst({ where: { projectId: id }, orderBy: { number: "desc" } });
  if (!latest) redirect(`/p/${id}/storyboard`);
  if (latest.status === "ready" && project.status !== "rendering") redirect(`/p/${id}`);
  return <RenderProgress projectId={id} version={latest.number} />;
}
