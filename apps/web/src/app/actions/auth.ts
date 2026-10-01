"use server";
import { db } from "@frameflow/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endAllSessions, endSession, hashPassword, requireUser, startSession, verifyPassword } from "@/lib/auth";
import { consumeToken, sendResetEmail, sendVerifyEmail } from "@/lib/email-tokens";
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
  // a failed email doesn't block sign-up: the app shows a "resend" button until the email is confirmed
  await sendVerifyEmail(user).catch((e) => console.error(`verification email to user ${user.id} failed:`, e));
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
  if (user.disabledAt) return { error: "This account has been disabled. Contact support if you think this is a mistake.", fields };
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ---------- email verification ----------

export async function resendVerification(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (user.emailVerifiedAt) return { ok: true, message: "Your email is already confirmed." };
  if (!(await allow(`verify-mail:${user.id}`, 3, 3600))) return { ok: false, message: "We already sent a few emails; wait a bit and check your spam folder." };
  try {
    await sendVerifyEmail(user);
  } catch (e) {
    console.error(`verification email to user ${user.id} failed:`, e);
    return { ok: false, message: "We couldn't send the email right now. Try again in a few minutes." };
  }
  return { ok: true, message: `Sent. Check ${user.email}.` };
}

// ---------- password reset ----------

export type ForgotState = { error?: string; sent?: boolean; email?: string } | undefined;

export async function forgotPassword(_: ForgotState, form: FormData): Promise<ForgotState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email", email };
  if (!(await allow(`forgot:${await clientIp()}`, 10, 3600)) || !(await allow(`forgot:${email}`, 3, 3600)))
    return { error: "Too many requests; try again in an hour", email };
  const user = await db().user.findUnique({ where: { email } });
  // the same answer either way, so the form doesn't reveal which emails have accounts
  if (user && !user.disabledAt) await sendResetEmail(user).catch((e) => console.error(`reset email to user ${user.id} failed:`, e));
  return { sent: true, email };
}

export type ResetState = { error?: string } | undefined;

const ResetSchema = z
  .object({ token: z.string().min(1), password: z.string().min(8, "Use at least 8 characters").max(200), confirm: z.string() })
  .refine((v) => v.password === v.confirm, "The two passwords don't match");

export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const parsed = ResetSchema.safeParse({ token: form.get("token") ?? "", password: form.get("password") ?? "", confirm: form.get("confirm") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const userId = await consumeToken(parsed.data.token, "reset");
  if (!userId) return { error: "This link has expired or was already used. Ask for a new one." };
  const before = await db().user.findUniqueOrThrow({ where: { id: userId } });
  const user = await db().user.update({
    where: { id: userId },
    // opening the link proves the inbox is theirs, so it also confirms the email
    data: { passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: before.emailVerifiedAt ?? new Date() },
  });
  await endAllSessions(userId); // sign out every other device
  if (user.disabledAt) redirect("/login");
  await startSession(userId);
  redirect("/");
}
