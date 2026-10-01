"use client";
import { ArrowLeft, LoaderCircle, Lock, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword, resetPassword, type ForgotState, type ResetState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELD = "h-11 rounded-xl pl-10 text-[0.95rem]";
const ICON = "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground";

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-gradient text-3xl font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function BackToLogin() {
  return (
    <p className="pt-2 text-center text-sm text-muted-foreground">
      <Link href="/login" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back to log in
      </Link>
    </p>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotPassword, undefined);
  if (state?.sent)
    return (
      <div className="space-y-6">
        <MailCheck className="size-10 text-[oklch(0.85_0.1_205)]" />
        <Heading title="Check your email" text={`If there is an account for ${state.email}, we sent it a link to set a new password. It works for 1 hour.`} />
        <BackToLogin />
      </div>
    );
  return (
    <div>
      <Heading title="Forgot your password?" text="Enter your account's email and we'll send you a link to set a new one." />
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className={ICON} />
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} placeholder="you@company.com" className={FIELD} />
          </div>
        </div>
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="mt-2 h-11 w-full rounded-xl text-[0.95rem]" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          {pending ? "Sending…" : "Send reset link"}
        </Button>
        <BackToLogin />
      </form>
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, undefined);
  return (
    <div>
      <Heading title="Set a new password" text="You'll be logged out on your other devices." />
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        {(["password", "confirm"] as const).map((name) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={name}>{name === "password" ? "New password" : "Type it again"}</Label>
            <div className="relative">
              <Lock className={ICON} />
              <Input id={name} name={name} type="password" autoComplete="new-password" required minLength={8} placeholder={name === "password" ? "At least 8 characters" : undefined} className={FIELD} />
            </div>
          </div>
        ))}
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="mt-2 h-11 w-full rounded-xl text-[0.95rem]" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          {pending ? "Saving…" : "Save and log in"}
        </Button>
      </form>
    </div>
  );
}
