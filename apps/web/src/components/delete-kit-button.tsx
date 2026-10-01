"use client";
import { useTransition } from "react";
import { deleteBrandKit } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

export function DeleteKitButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={() => start(() => void deleteBrandKit(id))}>
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
