import { db } from "@frameflow/db";
import { NewProjectForm } from "@/components/new-project-form";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New video" };

export default async function NewPage() {
  const user = await requireUser();
  const kits = await db().brandKit.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <h1 className="text-3xl font-semibold tracking-tight">New video</h1>
      <NewProjectForm kits={kits} />
    </div>
  );
}
