"use client";
import { LoaderCircle, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VoiceAvatar } from "@/components/voice-avatar";
import { catalog, voiceDescription, voiceInfo, voiceName, voicesFor, type VoiceInfo } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export interface PlanVoice {
  engine: string;
  voiceId: string;
  speed: number;
  style?: string;
}

const SPEEDS = [0.8, 0.9, 1, 1.1, 1.2];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// One preview at a time across the page.
let playing: HTMLAudioElement | null = null;

export function PreviewButton({ voiceId, language, style }: { voiceId: string; language: string; style?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const play = async () => {
    if (state === "playing") {
      audio.current?.pause();
      return setState("idle");
    }
    setState("loading");
    const url = `/api/voice-sample?${new URLSearchParams({ voice: voiceId, lang: language, ...(style ? { style } : {}) })}`;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Couldn't play the preview");
      return setState("idle");
    }
    const el = new Audio(URL.createObjectURL(await res.blob()));
    playing?.pause();
    playing = audio.current = el;
    el.onended = el.onpause = () => setState("idle");
    await el.play().catch(() => setState("idle"));
    setState("playing");
  };
  return (
    <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={play} disabled={state === "loading"} aria-label="Play a preview of this voice" title="Play a preview">
      {state === "loading" ? <LoaderCircle className="animate-spin" /> : state === "playing" ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
    </Button>
  );
}

export function VoiceSelect({ value, language, onChange, allowSame, size }: { value: string; language: string; onChange: (id: string) => void; allowSame?: boolean; size?: "sm" }) {
  const voices = voicesFor(language);
  const free = voices.filter((v) => v.tier === "free");
  const pro = voices.filter((v) => v.tier === "pro");
  const item = (v: (typeof voices)[number]) => (
    <SelectItem key={v.id} value={v.id} className="py-1.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <VoiceAvatar voice={v} size={size === "sm" ? 22 : 28} badge={false} />
        <span className="truncate font-medium">{voiceName(v)}</span>
        <span className="truncate text-xs text-muted-foreground">{voiceDescription(v)}</span>
        <span className="text-[10px] text-muted-foreground">{v.engine === "kokoro" ? "Fast" : "Natural"}</span>
        {v.tier === "pro" && <Badge className="h-4 px-1.5 text-[10px]">Pro</Badge>}
      </span>
    </SelectItem>
  );
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size={size} className="w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowSame && (
          <>
            <SelectItem value="same">Same as the video</SelectItem>
            <SelectSeparator />
          </>
        )}
        <SelectGroup>
          <SelectLabel>Free voices</SelectLabel>
          {free.map(item)}
        </SelectGroup>
        {pro.length > 0 && (
          <SelectGroup>
            <SelectLabel>Premium voices (Pro)</SelectLabel>
            {pro.map(item)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

// The video's voice: which voice, how it speaks (Indic voices) and how fast. Pro customizations are marked;
// anyone can try them, downloading a video that uses them needs Pro.
export function VoicePanel({ voice, language, onChange, isPro }: { voice: PlanVoice; language: string; onChange: (v: PlanVoice) => void; isPro: boolean }) {
  const info = voiceInfo(voice.voiceId);
  const parler = info?.engine === "indic-parler";
  const pick = (id: string) => {
    const next = voiceInfo(id)!;
    const { style, ...rest } = voice;
    onChange(next.engine === "indic-parler" ? { ...rest, voiceId: id, engine: next.engine, ...(style ? { style } : {}) } : { ...rest, voiceId: id, engine: next.engine });
  };
  const proLabel = isPro ? null : <Badge className="h-4 px-1.5 text-[10px]">Pro</Badge>;
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
      <div className="min-w-0 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Voice</Label>
        <div className="flex gap-2">
          <VoiceSelect value={voice.voiceId} language={language} onChange={pick} />
          <PreviewButton voiceId={voice.voiceId} language={language} style={parler ? voice.style : undefined} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">Speaking style {proLabel}</Label>
        <Select value={parler ? (voice.style ?? "natural") : "natural"} disabled={!parler} onValueChange={(s) => onChange({ ...voice, ...(s === "natural" ? { style: undefined } : { style: s }) })}>
          <SelectTrigger className="w-full sm:w-36" title={parler ? undefined : "Natural (premium) voices can change how they speak"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {catalog.styles.map((s) => (
              <SelectItem key={s} value={s}>
                {cap(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">Speed {proLabel}</Label>
        <Select value={String(voice.speed)} onValueChange={(s) => onChange({ ...voice, speed: Number(s) })}>
          <SelectTrigger className="w-full sm:w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEEDS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s === 1 ? "Normal" : `${s}x`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Voice cards for the new video form: the language's voices with avatars, a preview each, and "let the director pick".
export function VoiceCards({ language, value, onChange, isPro }: { language: string; value: string; onChange: (id: string) => void; isPro: boolean }) {
  const voices = voicesFor(language);
  const card = (v: VoiceInfo) => {
    const active = value === v.id;
    return (
      <div
        key={v.id}
        role="radio"
        aria-checked={active}
        tabIndex={0}
        onClick={() => onChange(v.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onChange(v.id))}
        className={cn(
          "group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
          active ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
        )}
      >
        <VoiceAvatar voice={v} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{voiceName(v)}</span>
            {v.tier === "pro" && <Badge className="h-4 px-1.5 text-[10px]">Pro</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[voiceDescription(v), v.engine === "kokoro" ? "Fast" : "Natural"].filter(Boolean).join(" · ")}
          </div>
        </div>
        <span onClick={(e) => e.stopPropagation()}>
          <PreviewButton voiceId={v.id} language={language} />
        </span>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Voice" className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">
        <div
          role="radio"
          aria-checked={value === ""}
          tabIndex={0}
          onClick={() => onChange("")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onChange(""))}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
            value === "" ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
          )}
        >
          <span className="flex size-[42px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-teal))] text-lg">✨</span>
          <div>
            <div className="text-sm font-medium">Let the director pick</div>
            <div className="text-xs text-muted-foreground">A free voice that suits the video</div>
          </div>
        </div>
        {voices.map(card)}
      </div>
      {!isPro && voices.some((v) => v.id === value && v.tier === "pro") && (
        <p className="text-xs text-muted-foreground">Pro voice: you can make and watch the video with a watermark; downloading it needs Pro.</p>
      )}
    </div>
  );
}
