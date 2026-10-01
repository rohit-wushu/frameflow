import { db } from "@frameflow/db";
import type { Brand } from "@frameflow/scene-schema";
import { DeleteKitButton } from "@/components/delete-kit-button";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Brand kits" };

export default async function BrandsPage() {
  const user = await requireUser();
  const kits = await db().brandKit.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Brand kits</h1>
        <p className="text-sm text-muted-foreground">Save a brand on the brand check screen, then pick it when you start a new video.</p>
      </div>
      {!kits.length && <p className="text-muted-foreground">No brand kits yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((k) => {
          const b = k.brand as Brand;
          return (
            <div key={k.id} className="space-y-4 rounded-xl border bg-card p-5">
              <div className="flex items-center gap-3">
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${b.logoUrl}`} alt="" className="h-8 max-w-28 object-contain" />
                ) : null}
                <div className="font-medium">{k.name}</div>
              </div>
              <div className="flex gap-2">
                {Object.entries(b.colors).map(([role, c]) => (
                  <div key={role} title={`${role} ${c}`} className="size-7 rounded-md border" style={{ background: c }} />
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {b.font.heading} / {b.font.body}
              </div>
              <DeleteKitButton id={k.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
