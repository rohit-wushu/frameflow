"use client";
import { speechSeconds, type SpeechModel } from "@frameflow/scene-schema";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { renderStoryboard, saveStoryboard, type Issue } from "@/app/actions/projects";
import { ChatPanel } from "@/components/chat-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectState } from "@/hooks/use-project-state";
import { catalog, templateInfo, templateLabel } from "@/lib/catalog";
import { IconList, type Assets } from "./content-fields";
import { SceneCard, type Scene } from "./scene-card";

export interface EditablePlan {
  title: string;
  mood: string;
  voice: { engine: string; voiceId: string; speed: number };
  music: { mode: string; mood: string };
  scenes: Scene[];
  targetDuration: number;
  assets: Assets; // images scenes can show (fixed by the server)
}

const SPEECH: SpeechModel = {
  rates: Object.fromEntries(catalog.voices.map((v) => [v.id, v.rate])),
  defaultRate: catalog.speech.defaultRate,
  pause: catalog.speech.pause,
  overhead: 0, // added below
};

// How long a scene will be: spoken length + padding, within the template's range (same model as the validator).
export function sceneTiming(scene: Scene, voice: EditablePlan["voice"]) {
  const t = templateInfo(scene.template);
  if (!t) return { est: scene.estDuration, spoken: 0, tooLong: false };
  if (!scene.voiceover.trim()) return { est: Math.min(Math.max(scene.estDuration, t.minDuration), t.maxDuration), spoken: 0, tooLong: false };
  const spoken = speechSeconds(scene.voiceover, voice.voiceId, voice.speed, SPEECH) + catalog.speech.overhead;
  const est = Math.round(Math.min(Math.max(spoken, t.minDuration), t.maxDuration) * 10) / 10;
  return { est, spoken, tooLong: spoken > t.maxDuration - 0.5 };
}

const withTimings = (plan: EditablePlan): EditablePlan => ({ ...plan, scenes: plan.scenes.map((s) => ({ ...s, estDuration: sceneTiming(s, plan.voice).est })) });

let counter = 0;
const newId = (template: string, taken: Set<string>) => {
  let id: string;
  do id = `${template.replace(/_/g, "-")}-${Date.now().toString(36).slice(-4)}${counter++}`;
  while (taken.has(id));
  return id;
};

export function Storyboard({ projectId, initial, format, language, rendered, messages }: { projectId: string; initial: EditablePlan; format: string; language: string; rendered: boolean; messages: ProjectState["messages"] }) {
  const router = useRouter();
  const [plan, setPlan] = useState<EditablePlan>(() => withTimings(initial));
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (fn: (p: EditablePlan) => EditablePlan) => {
    setPlan((p) => withTimings(fn(p)));
    setDirty(true);
  };
  const setScene = (i: number, s: Scene) => update((p) => ({ ...p, scenes: p.scenes.map((x, j) => (j === i ? s : x)) }));
  const move = (i: number, d: -1 | 1) =>
    update((p) => {
      const scenes = [...p.scenes];
      [scenes[i], scenes[i + d]] = [scenes[i + d], scenes[i]];
      return { ...p, scenes };
    });
  const remove = (i: number) => update((p) => ({ ...p, scenes: p.scenes.filter((_, j) => j !== i) }));
  const add = (at: number, template: string) =>
    update((p) => {
      const t = templateInfo(template)!;
      const content = structuredClone(t.example.content);
      if (typeof content.image === "string" && !p.assets[content.image]) content.image = Object.keys(p.assets)[0];
      const scene: Scene = { id: newId(template, new Set(p.scenes.map((s) => s.id))), template, content, voiceover: t.example.voiceover, estDuration: t.example.estDuration, sfx: [], transitionOut: "cut" };
      const scenes = [...p.scenes];
      scenes.splice(at, 0, scene);
      return { ...p, scenes };
    });

  const total = plan.scenes.reduce((s, x) => s + x.estDuration, 0);
  const [lo, hi] = [plan.targetDuration * 0.85, plan.targetDuration * 1.15];

  // server issues by scene index; the rest are shown on top
  const { byScene, general } = useMemo(() => {
    const byScene: Record<number, Issue[]> = {};
    const general: Issue[] = [];
    for (const issue of issues) {
      const m = /^scenes\[(\d+)\]\.?(.*)$/.exec(issue.path);
      if (m) (byScene[Number(m[1])] ??= []).push({ path: m[2], message: issue.message });
      else general.push(issue);
    }
    return { byScene, general };
  }, [issues]);

  const payload = () => ({ title: plan.title, mood: plan.mood, voice: plan.voice, music: plan.music, scenes: plan.scenes });
  const handle = (r: { ok: boolean; error?: string; issues?: Issue[] } | undefined, okMessage?: string) => {
    if (!r) return true; // redirected
    if (r.ok) {
      setIssues([]);
      setError(null);
      setDirty(false);
      if (okMessage) toast.success(okMessage);
      return true;
    }
    setIssues(r.issues ?? []);
    setError(r.error ?? (r.issues?.length ? `Fix ${r.issues.length} problem${r.issues.length > 1 ? "s" : ""} first (marked below).` : "Something went wrong"));
    return false;
  };
  const save = () => start(async () => void handle(await saveStoryboard(projectId, payload()), "Saved"));
  const render = () => start(async () => void handle(await renderStoryboard(projectId, payload())));
  const saveBeforeChat = useCallback(async () => (dirty ? handle(await saveStoryboard(projectId, payload())) : true), [dirty, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedScene = plan.scenes.find((s) => s.id === selected);
  const selectedIndex = plan.scenes.findIndex((s) => s.id === selected);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <IconList />
      <div className="space-y-6">
        <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label className="text-xs text-muted-foreground">Title (internal)</Label>
            <Input value={plan.title} maxLength={120} onChange={(e) => update((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Voice</Label>
            <Select value={plan.voice.voiceId} onValueChange={(v) => update((p) => ({ ...p, voice: { ...p.voice, voiceId: v } }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.voices.filter((v) => v.lang === (language === "en" ? "en" : "hi")).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Music</Label>
            <Select value={plan.music.mood} onValueChange={(v) => update((p) => ({ ...p, music: { ...p.music, mood: v } }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.musicMoods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Style</Label>
            <Select value={plan.mood} onValueChange={(v) => update((p) => ({ ...p, mood: v }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.moods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(error || general.length > 0) && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              {general.map((g) => (
                <div key={g.path + g.message}>
                  {g.path === "scenes" ? "" : `${g.path}: `}
                  {g.message}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {plan.scenes.map((scene, i) => (
          <SceneCard
            key={scene.id}
            index={i}
            count={plan.scenes.length}
            scene={scene}
            timing={sceneTiming(scene, plan.voice)}
            issues={byScene[i] ?? []}
            selected={scene.id === selected}
            onSelect={() => setSelected(scene.id === selected ? null : scene.id)}
            onChange={(s) => setScene(i, s)}
            onMove={(d) => move(i, d)}
            onRemove={() => remove(i)}
            onAdd={(template) => add(i + 1, template)}
            assets={plan.assets}
          />
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Add a scene</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {catalog.templates.filter((t) => !t.schema.required?.includes("image") || Object.keys(plan.assets).length).map((t) => (
              <DropdownMenuItem key={t.name} onClick={() => add(plan.scenes.length, t.name)} className="flex-col items-start gap-0.5">
                <span className="font-medium">{templateLabel(t.name)}</span>
                <span className="text-xs text-muted-foreground">{t.whenToUse.split(". ")[0]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)] lg:self-start">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Length</span>
            <span className={total < lo || total > hi ? "text-amber-400" : ""}>
              ≈ {total.toFixed(1)} s <span className="text-muted-foreground">of {plan.targetDuration} s</span>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {plan.scenes.length} scenes · {format} · cuts land on the music&apos;s beat, so the final length moves by a second or two.
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" size="lg" disabled={pending} onClick={render}>
              {pending ? "Checking…" : rendered ? "Render new version" : "Render video"}
            </Button>
            <Button variant="secondary" size="lg" disabled={pending || !dirty} onClick={save}>
              Save
            </Button>
          </div>
        </div>
        <ChatPanel
          className="h-[420px] lg:h-auto lg:flex-1"
          projectId={projectId}
          initial={messages}
          render={false}
          scene={selectedScene ? { id: selectedScene.id, label: `scene ${selectedIndex + 1} (${templateLabel(selectedScene.template)})` } : null}
          suggestions={selectedScene ? ["Make this scene punchier", "Shorter voiceover here"] : ["Make it more playful", "A stronger hook"]}
          beforeSend={saveBeforeChat}
          onDone={() => router.refresh()}
        />
      </div>
    </div>
  );
}
