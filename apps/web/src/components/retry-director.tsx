"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { retryDirector } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

export function RetryDirector({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await retryDirector(projectId);
          if (!r.ok) toast.error(r.error ?? "Could not start");
          else router.refresh();
        })
      }
    >
      {pending ? "Starting…" : "Try again"}
    </Button>
  );
}
