"use client";
import { MailWarning } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { resendVerification } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

// Shown until the user confirms their email (rendering and AI requests are blocked until then).
export function VerifyBanner({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="border-b border-amber-400/20 bg-amber-400/[0.08]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
        <MailWarning className="size-4 shrink-0 text-amber-300" />
        <span className="flex-1">
          Confirm your email to start making videos. We sent a link to <strong>{email}</strong>.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resendVerification();
              (r.ok ? toast.success : toast.error)(r.message);
            })
          }
        >
          {pending ? "Sending…" : "Resend email"}
        </Button>
      </div>
    </div>
  );
}
