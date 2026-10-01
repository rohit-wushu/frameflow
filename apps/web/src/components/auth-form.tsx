"use client";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELD = "h-11 rounded-xl pl-10 text-[0.95rem]";

function Icon({ icon: I }: { icon: typeof Mail }) {
  return <I className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />;
}

export function AuthForm({ mode, inviteOnly }: { mode: "login" | "signup"; inviteOnly?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="mb-8 space-y-2">
        <h1 className="text-gradient text-3xl font-semibold tracking-[-0.03em]">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted-foreground">{mode === "login" ? "Log in to keep making videos." : "Start free. No card needed."}</p>
      </div>
      <form action={action} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <div className="relative">
              <Icon icon={User} />
              <Input id="name" name="name" autoComplete="name" required defaultValue={state?.fields?.name} className={FIELD} />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Icon icon={Mail} />
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} placeholder="you@company.com" className={FIELD} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Icon icon={Lock} />
            <Input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              placeholder={mode === "signup" ? "At least 8 characters" : undefined}
              className={`${FIELD} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {mode === "signup" && inviteOnly && (
          <div className="space-y-2">
            <Label htmlFor="code">Invite code</Label>
            <div className="relative">
              <Icon icon={KeyRound} />
              <Input id="code" name="code" required className={FIELD} />
            </div>
          </div>
        )}
        {state?.error && (
          <Alert variant="destructive" className="animate-fade-up">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="group mt-2 h-11 w-full rounded-xl text-[0.95rem]" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          {pending ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
          {!pending && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
        </Button>
        <p className="pt-2 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href="/signup" className="font-medium text-foreground underline decoration-white/25 underline-offset-4 transition hover:decoration-primary">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Have an account?{" "}
              <Link href="/login" className="font-medium text-foreground underline decoration-white/25 underline-offset-4 transition hover:decoration-primary">
                Log in
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
