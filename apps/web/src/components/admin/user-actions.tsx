"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteUser, extendPro, markVerified, sendPasswordReset, setDisabled, setPlan, setRole, signOutUser, type AdminResult } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Target = { id: string; email: string; tier: "free" | "pro"; proForever: boolean; verified: boolean; disabled: boolean; admin: boolean; self: boolean };

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<AdminResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error);
    });
  return { pending, run };
}

export function PlanControls({ user }: { user: Target }) {
  const { pending, run } = useRun();
  const [days, setDays] = useState("30");
  const n = Number(days);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="days" className="text-xs text-muted-foreground">
            Days
          </Label>
          <Input id="days" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} className="h-8 w-24" />
        </div>
        <Button size="sm" disabled={pending || !(n >= 1) || user.proForever} onClick={() => run(() => extendPro(user.id, n))}>
          {user.tier === "pro" ? `Add ${n || 0} days of Pro` : `Give Pro for ${n || 0} days`}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending || user.proForever} onClick={() => run(() => setPlan(user.id, "pro", null))}>
          Pro with no end date
        </Button>
        <Button size="sm" variant="outline" disabled={pending || user.tier === "free"} onClick={() => run(() => setPlan(user.id, "free", null))}>
          Move to Free
        </Button>
      </div>
    </div>
  );
}

export function AccountControls({ user }: { user: Target }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      {!user.verified && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markVerified(user.id))}>
          Mark email confirmed
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => sendPasswordReset(user.id))}>
        Send password reset email
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => signOutUser(user.id))}>
        Sign out everywhere
      </Button>
      {!user.self && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setRole(user.id, user.admin ? "user" : "admin"))}>
          {user.admin ? "Remove admin" : "Make admin"}
        </Button>
      )}
      {!user.self && (
        <Button size="sm" variant={user.disabled ? "outline" : "destructive"} disabled={pending} onClick={() => run(() => setDisabled(user.id, !user.disabled))}>
          {user.disabled ? "Enable account" : "Disable account"}
        </Button>
      )}
    </div>
  );
}

export function DeleteUser({ user }: { user: Target }) {
  const { pending, run } = useRun();
  const [confirm, setConfirm] = useState("");
  if (user.self) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Delete account and all data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user.email}?</DialogTitle>
          <DialogDescription>
            This deletes the account, its videos, uploads and brand kits for good. Payment records are kept (without the account) for tax. It
            can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-email">Type the email to confirm</Label>
          <Input id="confirm-email" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={user.email} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={pending || confirm.trim().toLowerCase() !== user.email} onClick={() => run(() => deleteUser(user.id, confirm))}>
            {pending ? "Deleting…" : "Delete for good"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
