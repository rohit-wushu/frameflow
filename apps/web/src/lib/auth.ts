import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@frameflow/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

// Email + password accounts with database sessions. The cookie holds a random token; the database keeps
// only its SHA-256, so a leaked sessions table can't be used to log in.
const COOKIE = "ff_session";
const SESSION_DAYS = 30;
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, N, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem });
  return timingSafeEqual(actual, expected);
}

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");
const secureCookies = () => (process.env.APP_URL ?? "").startsWith("https://") || process.env.NODE_ENV === "production";

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db().session.create({ data: { id: tokenId(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", expires: expiresAt });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db().session.deleteMany({ where: { id: tokenId(token) } });
  store.delete(COOKIE);
}

// The signed-in user, or null. Memoized per request.
export const currentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db().session.findUnique({ where: { id: tokenId(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const { passwordHash: _, ...user } = session.user;
  return user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export const SESSION_COOKIE = COOKIE;
