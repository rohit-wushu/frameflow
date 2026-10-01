import "server-only";
import { db, type Prisma } from "@frameflow/db";

// Records a change to an account (admin action or payment), shown in the admin panel's activity log.
export async function audit(action: string, detail: string, opts: { actorId?: string | null; targetId?: string | null; tx?: Prisma.TransactionClient } = {}) {
  await (opts.tx ?? db()).auditLog.create({ data: { action, detail, actorId: opts.actorId ?? null, targetId: opts.targetId ?? null } });
}
