"use client";
import type { Brand } from "@frameflow/scene-schema";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmBrand } from "@/app/actions/projects";
import { LogoUpload } from "@/components/logo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const ROLES = [
  ["primary", "Primary", "buttons, highlights"],
  ["secondary", "Secondary", "accents"],
  ["background", "Background", ""],
  ["text", "Text", ""],
] as const;

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        {label} {hint && <span className="opacity-60">· {hint}</span>}
      </Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5" aria-label={label} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase" maxLength={7} />
      </div>
    </div>
  );
}

export function BrandForm({ projectId, initial, logoKey, fonts }: { projectId: string; initial: Brand; logoKey: string | null; fonts: string[] }) {
  const [brand, setBrand] = useState<Brand>(initial);
  const [logo, setLogo] = useState<string | null>(logoKey);
  const [saveKit, setSaveKit] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Brand>) => setBrand((b) => ({ ...b, ...patch }));
  const submit = (mode: "confirm" | "auto") =>
    start(async () => {
      const r = await confirmBrand(projectId, { mode, brand, logoKey: logo, saveKit });
      if (r && !r.ok) toast.error(r.error ?? "Could not save the brand");
    });
  const fontSelect = (role: "heading" | "body") => (
    <Select value={brand.font[role]} onValueChange={(v) => set({ font: { ...brand.font, [role]: v } })}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {fonts.map((f) => (
          <SelectItem key={f} value={f}>{f}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <div className="space-y-3">
          <Label>Logo</Label>
          <LogoUpload value={logo} onChange={(key) => setLogo(key)} />
        </div>
        <div className="space-y-3">
          <Label htmlFor="brand-name">Brand name</Label>
          <Input id="brand-name" value={brand.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          {ROLES.map(([role, label, hint]) => (
            <ColorField key={role} label={label} hint={hint} value={brand.colors[role]} onChange={(v) => set({ colors: { ...brand.colors, [role]: v } })} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Heading font</Label>
            {fontSelect("heading")}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Body font</Label>
            {fontSelect("body")}
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={saveKit} onCheckedChange={setSaveKit} /> Save as a brand kit for later videos
        </label>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" disabled={pending} onClick={() => submit("confirm")}>
            {pending ? "Starting the director…" : "Looks good, write the script"}
          </Button>
          <Button size="lg" variant="ghost" disabled={pending} onClick={() => submit("auto")}>
            Let the director pick colors and fonts
          </Button>
        </div>
      </div>

      {/* preview in the brand's colors and fonts (the fonts come from Google Fonts, like the render's) */}
      <div className="space-y-3">
        <link
          rel="stylesheet"
          precedence="default"
          href={`https://fonts.googleapis.com/css2?${[...new Set([brand.font.heading, brand.font.body])].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;700`).join("&")}&display=swap`}
        />
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div className="flex aspect-video flex-col justify-center gap-3 rounded-xl border p-6" style={{ background: brand.colors.background, color: brand.colors.text }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${logo}`} alt="" className="h-6 max-w-32 object-contain object-left" />
          )}
          <div className="text-xl font-bold leading-tight" style={{ fontFamily: `"${brand.font.heading}", sans-serif` }}>
            {brand.name || "Your brand"} makes it <span style={{ color: brand.colors.primary }}>simple</span>
          </div>
          <div className="text-xs opacity-70" style={{ fontFamily: `"${brand.font.body}", sans-serif` }}>
            {brand.font.heading} and {brand.font.body}
          </div>
          <div className="flex gap-2">
            <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: brand.colors.primary, color: brand.colors.background }}>
              Get started
            </span>
            <span className="rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: brand.colors.secondary, color: brand.colors.secondary }}>
              Learn more
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
