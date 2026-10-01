"use server";
import { db } from "@frameflow/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { allow, clientIp } from "@/lib/rate-limit";

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60),
  email: z.email("Enter a valid email").trim().toLowerCase().max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  code: z.string().trim().optional(),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const fields = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  const parsed = SignupSchema.safeParse({ ...fields, password: form.get("password"), code: form.get("code") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  // invite-only when SIGNUP_CODE is set
  if (process.env.SIGNUP_CODE && parsed.data.code !== process.env.SIGNUP_CODE) return { error: "That invite code is not right", fields };
  if (!(await allow(`signup:${await clientIp()}`, 10, 3600))) return { error: "Too many sign-ups from here; try again later", fields };
  const exists = await db().user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "There is already an account with this email", fields };
  const user = await db().user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) } });
  await startSession(user.id);
  redirect("/");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const fields = { email };
  if (!(await allow(`login:${email}:${await clientIp()}`, 10, 15 * 60))) return { error: "Too many attempts; wait 15 minutes", fields };
  const user = await db().user.findUnique({ where: { email } });
  // same message either way, so the form doesn't reveal which emails have accounts
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Wrong email or password", fields };
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
