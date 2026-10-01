"use client";
import type { Issue } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalog, templateInfo, templateLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { VoiceSelect } from "@/components/voice-picker";
import { ContentFields, type Assets } from "./content-fields";

export interface Scene {
  id: string;
  template: string;
  content: Record<string, unknown>;
  voiceover: string;
  estDuration: number;
  sfx: unknown[];
  transitionOut: string;
  textScale?: number;
  voiceId?: string; // this scene in another voice (Pro)
}


export function SceneCard({
  index,
  count,
  scene,
  timing,
  issues,
  selected,
  onSelect,
  onChange,
  onMove,
  onRemove,
  onAdd,
  assets,
  language,
  planVoiceId,
}: {
  index: number;
  count: number;
  scene: Scene;
  timing: { est: number; spoken: number; tooLong: boolean };
  issues: Issue[];
  selected: boolean;
  onSelect: () => void;
  onChange: (s: Scene) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onAdd: (template: string) => void;
  assets: Assets;
  language: string;
  planVoiceId: string;
}) {
  const t = templateInfo(scene.template);
  const contentErrors = Object.fromEntries(issues.filter((i) => i.path.startsWith("content.")).map((i) => [i.path.slice("content.".length), i.message]));
  const otherErrors = issues.filter((i) => !i.path.startsWith("content."));
  const switchTemplate = (name: string) => {
    const next = templateInfo(name)!;
    // keep the voiceover; start the fields from the new template's example
    const content = structuredClone(next.example.content);
    if (typeof content.image === "string" && !assets[content.image]) content.image = Object.keys(assets)[0];
    onChange({ ...scene, template: name, content, sfx: [] });
  };
  const scale = scene.textScale ?? 1;

  return (
    <div className={cn("rounded-xl border bg-card transition", selected && "border-primary/70 ring-1 ring-primary/40", issues.length > 0 && "border-destructive/60")}>
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
        <button type="button" onClick={onSelect} className="text-sm font-medium" title="Select this scene for chat changes">
          Scene {index + 1}
        </button>
        <Select value={scene.template} onValueChange={switchTemplate}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {catalog.templates.map((x) => (
              <SelectItem key={x.name} value={x.name}>
                {templateLabel(x.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className={cn("text-xs text-muted-foreground", timing.tooLong && "text-amber-400")}>
          ≈ {timing.est.toFixed(1)} s{t ? ` (${t.minDuration}-${t.maxDuration} s)` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            ↑
          </Button>
          <Button variant="ghost" size="icon" className="size-8" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
            ↓
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                ⋯
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSelect}>{selected ? "Unselect" : "Select for chat"}</DropdownMenuItem>
              {catalog.templates.map((x) => (
                <DropdownMenuItem key={x.name} onClick={() => onAdd(x.name)}>
                  Add {templateLabel(x.name)} after
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={onRemove} disabled={count <= 2} className="text-destructive">
                Delete scene
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-4">
          {t && <ContentFields idPrefix={scene.id} schema={t.schema} value={scene.content} onChange={(content) => onChange({ ...scene, content })} errors={contentErrors} assets={assets} />}
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${scene.id}-vo`} className="text-xs text-muted-foreground">
              Voiceover
            </Label>
            <Textarea id={`${scene.id}-vo`} value={scene.voiceover} maxLength={400} rows={4} className="resize-none" onChange={(e) => onChange({ ...scene, voiceover: e.target.value })} />
            {timing.tooLong && t && <p className="text-xs text-amber-400">About {timing.spoken.toFixed(1)} s spoken: too long for a {templateLabel(scene.template)} scene (max {t.maxDuration} s). Shorten it.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Transition out</Label>
              <Select value={scene.transitionOut} onValueChange={(v) => onChange({ ...scene, transitionOut: v })}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(catalog.transitions).map(([k, note]) => (
                    <SelectItem key={k} value={k} title={note}>
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${scene.id}-scale`} className="text-xs text-muted-foreground">
                Text size {Math.round(scale * 100)}%
              </Label>
              <input
                id={`${scene.id}-scale`}
                type="range"
                min={0.7}
                max={1.4}
                step={0.05}
                value={scale}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const { textScale: _, ...rest } = scene;
                  onChange(v === 1 ? rest : { ...scene, textScale: v });
                }}
                className="w-full accent-primary"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Voice in this scene</Label>
            <VoiceSelect
              size="sm"
              allowSame
              language={language}
              value={scene.voiceId && scene.voiceId !== planVoiceId ? scene.voiceId : "same"}
              onChange={(v) => {
                const { voiceId: _, ...rest } = scene;
                onChange(v === "same" ? rest : { ...scene, voiceId: v });
              }}
            />
          </div>
          {otherErrors.map((e) => (
            <p key={e.path + e.message} className="text-xs text-destructive">
              {e.path === "estDuration" ? "Length: " : e.path ? `${e.path}: ` : ""}
              {e.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
