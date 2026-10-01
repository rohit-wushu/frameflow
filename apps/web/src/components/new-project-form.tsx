"use client";
import { useActionState, useState } from "react";
import { createProject, type NewProjectState } from "@/app/actions/projects";
import { LogoUpload } from "@/components/logo-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { catalog } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 30, 60, 90];
const FORMAT_SHAPES: Record<string, string> = { "16:9": "w-10 h-6", "9:16": "w-5 h-9", "1:1": "w-7 h-7" };
const FORMAT_NAMES: Record<string, string> = { "16:9": "Landscape", "9:16": "Vertical", "1:1": "Square" };

function Choice<T extends string | number>({ name, options, value, onChange, render }: { name: string; options: T[]; value: T; onChange: (v: T) => void; render: (v: T) => React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={String(o)} className={cn("cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition", value === o ? "border-primary bg-primary/10" : "hover:bg-muted/50")}>
          <input type="radio" name={name} value={String(o)} checked={value === o} onChange={() => onChange(o)} className="sr-only" />
          {render(o)}
        </label>
      ))}
    </div>
  );
}

export function NewProjectForm({ kits }: { kits: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<NewProjectState, FormData>(createProject, undefined);
  const [duration, setDuration] = useState(30);
  const [format, setFormat] = useState("16:9");
  const [logo, setLogo] = useState<{ key: string; id: string } | null>(null);
  const [kit, setKit] = useState("none");
  return (
    <form action={action} className="space-y-10">
      <div className="space-y-3">
        <Label htmlFor="prompt" className="text-base">What is the video about?</Label>
        <Textarea
          id="prompt"
          name="prompt"
          required
          minLength={3}
          maxLength={600}
          rows={4}
          autoFocus
          placeholder="A 30-second launch video for our AI note-taking app: it records meetings, writes summaries and sends action items to Slack."
          className="resize-none text-base"
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <Label htmlFor="url">Website (optional)</Label>
          <Input id="url" name="url" placeholder="example.com" inputMode="url" disabled={kit !== "none"} />
          <p className="text-xs text-muted-foreground">We read its logo, colors, fonts and facts. The script only uses facts from here and your prompt.</p>
        </div>
        <div className="space-y-3">
          <Label>Logo (optional)</Label>
          <LogoUpload value={logo?.key ?? null} onChange={(key, id) => setLogo(key && id ? { key, id } : null)} />
          <input type="hidden" name="logoUpload" value={logo?.id ?? ""} />
        </div>
      </div>

      {kits.length > 0 && (
        <div className="space-y-3">
          <Label>Brand kit</Label>
          <Select value={kit} onValueChange={setKit}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (use the website or let the AI choose)</SelectItem>
              {kits.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="brandKit" value={kit === "none" ? "" : kit} />
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <Label>Length</Label>
          <Choice name="duration" options={DURATIONS} value={duration} onChange={setDuration} render={(d) => `${d} s`} />
        </div>
        <div className="space-y-3">
          <Label>Format</Label>
          <Choice
            name="format"
            options={catalog.formats}
            value={format}
            onChange={setFormat}
            render={(f) => (
              <span className="flex items-center gap-2.5">
                <span className={cn("rounded-[3px] border-2 border-current opacity-70", FORMAT_SHAPES[f])} />
                {FORMAT_NAMES[f]} <span className="text-muted-foreground">{f}</span>
              </span>
            )}
          />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <Label>Style</Label>
          <Select name="mood" defaultValue="auto">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Let the director choose</SelectItem>
              {catalog.moods.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <Label>Language</Label>
          <Select name="language" defaultValue="en">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">Hindi</SelectItem>
              <SelectItem value="hinglish">Hinglish</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <Label htmlFor="captions">Captions</Label>
          <div className="flex h-9 items-center gap-3">
            <Switch id="captions" name="captions" />
            <span className="text-sm text-muted-foreground">Word-by-word, burned in</span>
          </div>
        </div>
      </div>

      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full md:w-auto md:px-10" disabled={pending}>
        {pending ? "Starting…" : "Generate"}
      </Button>
    </form>
  );
}
