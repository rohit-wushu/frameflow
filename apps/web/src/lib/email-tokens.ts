import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db, type EmailTokenKind } from "@frameflow/db";
import { sendMail } from "./mail";
import { site } from "./site";

// One-time links for email verification and password reset. The link carries a random token; the
// database keeps only its SHA-256 (like sessions), and a token works once, before it expires.
const LIFETIME_MIN: Record<EmailTokenKind, number> = { verify: 48 * 60, reset: 60 };
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function newToken(userId: string, kind: EmailTokenKind): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const prisma = db();
  // only the latest link of a kind works
  await prisma.emailToken.deleteMany({ where: { userId, kind, usedAt: null } });
  await prisma.emailToken.create({ data: { id: hash(token), userId, kind, expiresAt: new Date(Date.now() + LIFETIME_MIN[kind] * 60_000) } });
  return token;
}

// Marks the token used and returns its user id, or null if it is unknown, used or expired.
export async function consumeToken(token: string, kind: EmailTokenKind): Promise<string | null> {
  if (!token) return null;
  const used = await db().emailToken.updateMany({ where: { id: hash(token), kind, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (used.count !== 1) return null;
  const row = await db().emailToken.findUnique({ where: { id: hash(token) } });
  return row?.userId ?? null;
}

// Checks a token without using it (to show the reset form only for a working link).
export async function tokenValid(token: string, kind: EmailTokenKind): Promise<boolean> {
  if (!token) return false;
  const row = await db().emailToken.findUnique({ where: { id: hash(token) } });
  return !!row && row.kind === kind && !row.usedAt && row.expiresAt > new Date();
}

export async function sendVerifyEmail(user: { id: string; email: string; name: string }) {
  const token = await newToken(user.id, "verify");
  await sendMail(
    user.email,
    `Confirm your email for ${site.name}`,
    [`Hi ${user.name},`, `Please confirm your email address to start making videos. The link works for 48 hours.`],
    { label: "Confirm email", url: `${site.url}/api/auth/verify?token=${token}` },
  );
}

export async function sendResetEmail(user: { id: string; email: string; name: string }) {
  const token = await newToken(user.id, "reset");
  await sendMail(
    user.email,
    `Reset your ${site.name} password`,
    [`Hi ${user.name},`, `Someone (hopefully you) asked to reset your password. The link works for 1 hour. If it wasn't you, ignore this email.`],
    { label: "Set a new password", url: `${site.url}/reset?token=${token}` },
  );
}
