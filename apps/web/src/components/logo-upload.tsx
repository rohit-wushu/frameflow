"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadLogo } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

// Uploads right away and reports the storage key (the form then sends only the key).
export function LogoUpload({ value, onChange, label = "Upload logo" }: { value: string | null; onChange: (key: string | null, id: string | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [broken, setBroken] = useState(false);
  const pick = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const r = await uploadLogo(form);
      if (!r.ok) toast.error(r.error);
      else {
        setBroken(false);
        onChange(r.key, r.id);
      }
    });
  };
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-2">
        {value && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${value}`} alt="Logo" className="max-h-full max-w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <span className="text-xs text-muted-foreground">No logo</span>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? "Uploading…" : value ? "Replace" : label}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null, null)}>
          Remove
        </Button>
      )}
    </div>
  );
}
