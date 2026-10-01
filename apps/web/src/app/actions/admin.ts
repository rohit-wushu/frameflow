"use server";
import { rm } from "node:fs/promises";
import { db } from "@frameflow/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { endAllSessions, requireAdmin } from "@/lib/auth";
import { sendResetEmail } from "@/lib/email-tokens";
import { storagePath } from "@/lib/storage";

// Admin panel actions. Every one checks the caller is an admin and writes an audit log entry.
export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

const DAY = 24 * 3600 * 1000;
const done = (userId: string, message?: string): AdminResult => {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { ok: true, message };
};

async function target(userId: string) {
  const admin = await requireAdmin();
  const user = await db().user.findUnique({ where: { id: String(userId) } });
  return { admin, user };
}

// Plan: "free", or "pro" for `days` days from now (0 / empty = Pro with no end date).
export async function setPlan(userId: string, tier: "free" | "pro", days: number | null): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  if (tier !== "free" && tier !== "pro") return { ok: false, error: "Unknown plan" };
  const n = days && Number.isFinite(days) && days > 0 ? Math.min(Math.round(days), 3650) : null;
  const proUntil = tier === "pro" && n ? new Date(Date.now() + n * DAY) : null;
  await db().user.update({ where: { id: user.id }, data: { tier, proUntil } });
  await audit("user.plan", tier === "free" ? "set to Free" : n ? `set to Pro for ${n} days` : "set to Pro with no end date", { actorId: admin.id, targetId: user.id });
  return done(user.id, "Plan updated");
}

// Adds days to the current Pro (or starts Pro now if it isn't active).
export async function extendPro(userId: string, days: number): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  const n = Math.round(Number(days));
  if (!Number.isFinite(n) || n < 1 || n > 3650) return { ok: false, error: "Days must be 1 to 3650" };
  if (user.tier === "pro" && !user.proUntil) return { ok: false, error: "This user already has Pro with no end date" };
  const now = new Date();
  const from = user.tier === "pro" && user.proUntil && user.proUntil > now ? user.proUntil : now;
  await db().user.update({ where: { id: user.id }, data: { tier: "pro", proUntil: new Date(from.getTime() + n * DAY) } });
  await audit("user.plan", `Pro extended by ${n} days`, { actorId: admin.id, targetId: user.id });
  return done(user.id, `Added ${n} days of Pro`);
}

export async function setDisabled(userId: string, disabled: boolean): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  if (user.id === admin.id) return { ok: false, error: "You can't disable your own account" };
  await db().user.update({ where: { id: user.id }, data: { disabledAt: disabled ? new Date() : null } });
  if (disabled) await endAllSessions(user.id);
  await audit(disabled ? "user.disable" : "user.enable", disabled ? "account disabled, signed out everywhere" : "account enabled", { actorId: admin.id, targetId: user.id });
  return done(user.id, disabled ? "Account disabled" : "Account enabled");
}

export async function markVerified(userId: string): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  if (user.emailVerifiedAt) return { ok: true, message: "Already confirmed" };
  await db().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await audit("user.verify", "email marked as confirmed", { actorId: admin.id, targetId: user.id });
  return done(user.id, "Email marked as confirmed");
}

export async function setRole(userId: string, role: "user" | "admin"): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  if (role !== "user" && role !== "admin") return { ok: false, error: "Unknown role" };
  if (user.id === admin.id && role !== "admin") return { ok: false, error: "You can't remove your own admin role" };
  await db().user.update({ where: { id: user.id }, data: { role } });
  await audit("user.role", `role set to ${role}`, { actorId: admin.id, targetId: user.id });
  return done(user.id, role === "admin" ? "Now an admin" : "No longer an admin");
}

export async function signOutUser(userId: string): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  await endAllSessions(user.id);
  await audit("user.signout", "signed out everywhere", { actorId: admin.id, targetId: user.id });
  return done(user.id, "Signed out everywhere");
}

export async function sendPasswordReset(userId: string): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  try {
    await sendResetEmail(user);
  } catch (e) {
    console.error(`reset email to user ${user.id} failed:`, e);
    return { ok: false, error: "The email could not be sent (check SMTP_URL)" };
  }
  await audit("user.reset", "password reset email sent", { actorId: admin.id, targetId: user.id });
  return done(user.id, `Reset link sent to ${user.email}`);
}

// Deletes the account with all its projects, uploads and files (for deletion requests). Payment rows go too,
// so the audit log keeps a copy of the essentials. Asks for the email as confirmation.
export async function deleteUser(userId: string, confirmEmail: string): Promise<AdminResult> {
  const { admin, user } = await target(userId);
  if (!user) return { ok: false, error: "No such user" };
  if (user.id === admin.id) return { ok: false, error: "You can't delete your own account here" };
  if (String(confirmEmail).trim().toLowerCase() !== user.email) return { ok: false, error: "Type the user's email exactly to confirm" };
  const prisma = db();
  const busy = await prisma.job.count({ where: { userId: user.id, status: { in: ["queued", "running"] } } });
  if (busy) return { ok: false, error: "This user has jobs running; try again when they finish" };
  const [projects, paid] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.payment.findMany({ where: { userId: user.id, status: "paid" }, select: { orderId: true, paymentId: true, amount: true, paidAt: true } }),
  ]);
  await prisma.user.delete({ where: { id: user.id } });
  await Promise.all([
    ...projects.flatMap((p) => [rm(storagePath(`projects/${p.id}`), { recursive: true, force: true }), rm(storagePath(`research/${p.id}`), { recursive: true, force: true })]),
    rm(storagePath(`uploads/${user.id}`), { recursive: true, force: true }),
  ]);
  const payments = paid.map((p) => `${p.paidAt?.toISOString().slice(0, 10)} ${p.amount / 100} INR ${p.orderId}/${p.paymentId}`).join("; ");
  await audit("user.delete", `deleted ${user.email} with ${projects.length} projects${payments ? `; payments: ${payments}` : ""}`, { actorId: admin.id, targetId: user.id });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
