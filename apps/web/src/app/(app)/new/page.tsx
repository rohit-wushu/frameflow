import { db, effectiveTier, usageFor } from "@frameflow/db";
import { NewProjectForm } from "@/components/new-project-form";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New video" };

export default async function NewPage() {
  const user = await requireUser();
  const prisma = db();
  const [kits, usage] = await Promise.all([
    prisma.brandKit.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
    usageFor(prisma, user),
  ]);
  return (
    <div className="space-y-8">
      <div className="animate-fade-up space-y-2">
        <p className="text-sm text-muted-foreground">Step 1 of 5</p>
        <h1 className="text-gradient text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Create a new video</h1>
        <p className="max-w-2xl text-muted-foreground">Tell us what it&apos;s about. Frameflow writes the script, records the voice, picks the music and animates every scene; you can edit it all before rendering.</p>
      </div>
      <NewProjectForm kits={kits} isPro={effectiveTier(user) === "pro"} videosLeft={usage.videosLimit === null ? null : Math.max(0, usage.videosLimit - usage.videos)} />
    </div>
  );
}
