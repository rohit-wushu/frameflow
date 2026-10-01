"use client";
import { ArrowRight, Captions, Gem, Globe, Leaf, LoaderCircle, PartyPopper, Sparkles, Target, Wand2, Zap } from "lucide-react";
import { useActionState, useState } from "react";
import { createProject, type NewProjectState } from "@/app/actions/projects";
import { LogoUpload } from "@/components/logo-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { VoiceAvatar } from "@/components/voice-avatar";
import { VoiceCards } from "@/components/voice-picker";
import { catalog, languageName, voiceInfo, voiceName } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const DURATIONS = [
  { value: 15, note: "Teaser" },
  { value: 30, note: "Ad" },
  { value: 60, note: "Explainer" },
  { value: 90, note: "Story" },
];
const FORMATS: Record<string, { name: string; use: string; shape: string; aspect: string }> = {
  "16:9": { name: "Landscape", use: "YouTube, websites", shape: "w-9 h-[1.3rem]", aspect: "aspect-video" },
  "9:16": { name: "Vertical", use: "Reels, Shorts, Stories", shape: "w-[1.15rem] h-8", aspect: "aspect-[9/16] max-h-[340px] mx-auto" },
  "1:1": { name: "Square", use: "Feed posts", shape: "w-7 h-7", aspect: "aspect-square max-h-[300px] mx-auto" },
};
const MOODS: { value: string; label: string; icon: typeof Zap }[] = [
  { value: "auto", label: "Auto", icon: Wand2 },
  { value: "energetic", label: "Energetic", icon: Zap },
  { value: "calm", label: "Calm", icon: Leaf },
  { value: "premium", label: "Premium", icon: Gem },
  { value: "playful", label: "Playful", icon: PartyPopper },
  { value: "serious", label: "Serious", icon: Target },
];
const IDEAS = [
  "A 30-second launch video for our AI note-taking app: it records meetings, writes summaries and sends action items to Slack.",
  "A vertical ad for our Diwali sale: 40% off all sarees, free delivery across India, order on our website.",
  "Explain how our budgeting app helps young professionals save money every month.",
  "Introduce our cloud kitchen: fresh home-style meals, delivered in 30 minutes in Bengaluru.",
];
const POPULAR = ["en", "hi", "hinglish", "bn", "ta", "te", "mr", "gu", "kn", "ml"];

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl border border-white/[0.07] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-teal))] text-xs font-semibold text-white">
          {n}
        </span>
        <div>
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const tile = (active: boolean) =>
  cn(
    "cursor-pointer rounded-xl border transition focus-within:ring-2 focus-within:ring-primary/50",
    active ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
  );

export function NewProjectForm({ kits, isPro, videosLeft }: { kits: { id: string; name: string }[]; isPro: boolean; videosLeft: number | null }) {
  const [state, action, pending] = useActionState<NewProjectState, FormData>(createProject, undefined);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [format, setFormat] = useState("16:9");
  const [logo, setLogo] = useState<{ key: string; id: string } | null>(null);
  const [kit, setKit] = useState("none");
  const [language, setLanguage] = useState("en");
  const [voice, setVoice] = useState("");
  const [mood, setMood] = useState("auto");
  const [captions, setCaptions] = useState(false);
  const lang = catalog.languages.find((l) => l.code === language)!;
  const chosen = voice ? voiceInfo(voice) : undefined;

  const pickLanguage = (code: string) => {
    setLanguage(code);
    if (voice && voiceInfo(voice)?.lang !== catalog.languages.find((l) => l.code === code)?.voices) setVoice("");
  };
  const langItem = (l: (typeof catalog.languages)[number]) => (
    <SelectItem key={l.code} value={l.code}>
      <span className="flex items-center gap-2">
        {l.name}
        {l.native !== l.name && <span className="text-muted-foreground">{l.native}</span>}
        {l.beta && <span className="rounded bg-amber-400/15 px-1 text-[10px] text-amber-300">beta</span>}
      </span>
    </SelectItem>
  );

  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="min-w-0 space-y-5">
        <Section n={1} title="Describe your video" hint="One or two lines: what you're promoting, who it's for, and the one thing to remember.">
          <Textarea
            id="prompt"
            name="prompt"
            required
            minLength={3}
            maxLength={600}
            rows={4}
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A 30-second launch video for our AI note-taking app…"
            className="resize-none rounded-xl text-base"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setPrompt(idea)}
                  className="max-w-[16rem] truncate rounded-full bg-white/[0.04] px-3 py-1 text-xs text-foreground/75 ring-1 ring-white/[0.08] transition hover:bg-white/[0.08] hover:text-foreground"
                  title={idea}
                >
                  <Sparkles className="mr-1 inline size-3 text-[oklch(0.85_0.1_292)]" />
                  {idea}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{prompt.length}/600</span>
          </div>
        </Section>

        <Section n={2} title="Your brand" hint="Optional. From your website we take the logo, colors, fonts and facts; the script only uses facts from there and your prompt.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="url">Website</Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="url" name="url" placeholder="example.com" inputMode="url" disabled={kit !== "none"} className="h-10 rounded-xl pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <LogoUpload value={logo?.key ?? null} onChange={(key, id) => setLogo(key && id ? { key, id } : null)} />
              <input type="hidden" name="logoUpload" value={logo?.id ?? ""} />
            </div>
          </div>
          {kits.length > 0 && (
            <div className="mt-5 space-y-2">
              <Label>Or use a saved brand kit</Label>
              <Select value={kit} onValueChange={setKit}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (use the website or let the AI choose)</SelectItem>
                  {kits.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="brandKit" value={kit === "none" ? "" : kit} />
            </div>
          )}
        </Section>

        <Section n={3} title="Length and format">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {DURATIONS.map((d) => (
                <label key={d.value} className={cn(tile(duration === d.value), "px-4 py-3")}>
                  <input type="radio" name="duration" value={d.value} checked={duration === d.value} onChange={() => setDuration(d.value)} className="sr-only" />
                  <div className="text-lg font-semibold tabular-nums">{d.value}s</div>
                  <div className="text-xs text-muted-foreground">{d.note}</div>
                </label>
              ))}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {catalog.formats.map((f) => (
                <label key={f} className={cn(tile(format === f), "flex items-center gap-3 px-4 py-3")}>
                  <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                  <span className="flex w-10 shrink-0 justify-center">
                    <span className={cn("rounded-[4px] border-2", format === f ? "border-[oklch(0.8_0.12_292)]" : "border-current opacity-60", FORMATS[f].shape)} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {FORMATS[f].name} <span className="text-muted-foreground">{f}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{FORMATS[f].use}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        <Section n={4} title="Language and voice" hint="Script, captions and voiceover are written in this language. Press ▶ to hear a voice.">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={pickLanguage}>
                <SelectTrigger className="h-10 w-full md:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectGroup>
                    <SelectLabel>Popular</SelectLabel>
                    {catalog.languages.filter((l) => POPULAR.includes(l.code)).map(langItem)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>More languages</SelectLabel>
                    {catalog.languages.filter((l) => !POPULAR.includes(l.code)).map(langItem)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <input type="hidden" name="language" value={language} />
              {lang.beta && <p className="text-xs text-amber-300/90">{lang.name} is in beta: check the voice and text before you publish.</p>}
            </div>
            <VoiceCards language={language} value={voice} onChange={setVoice} isPro={isPro} />
            <input type="hidden" name="voiceId" value={voice} />
          </div>
        </Section>

        <Section n={5} title="Style">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <label key={m.value} className={cn(tile(mood === m.value), "flex items-center gap-2 rounded-full px-4 py-2 text-sm")}>
                  <input type="radio" name="mood" value={m.value} checked={mood === m.value} onChange={() => setMood(m.value)} className="sr-only" />
                  <m.icon className="size-4 text-muted-foreground" />
                  {m.label}
                </label>
              ))}
            </div>
            <label htmlFor="captions" className={cn(tile(captions), "flex items-center gap-3 px-4 py-3")}>
              <Captions className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-sm font-medium">Captions</span>
                <span className="block text-xs text-muted-foreground">Word-by-word, burned into the video</span>
              </span>
              <Switch id="captions" name="captions" checked={captions} onCheckedChange={setCaptions} />
            </label>
          </div>
        </Section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="glass shine-border space-y-5 rounded-2xl border border-white/[0.07] p-5">
          <div className={cn("relative w-full overflow-hidden rounded-xl bg-[linear-gradient(150deg,color-mix(in_oklch,var(--brand-violet),black_25%),color-mix(in_oklch,var(--brand-teal),black_55%))] ring-1 ring-white/10", FORMATS[format].aspect)}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgb(255_255_255/0.18),transparent_55%)]" />
            <div className="absolute inset-0 flex flex-col justify-center gap-2 p-5">
              <div className="h-1.5 w-10 rounded-full bg-white/60" />
              <p className="line-clamp-3 text-[0.95rem] leading-snug font-semibold text-white">{prompt.trim() || "Your video's headline appears here"}</p>
              <div className="h-1.5 w-24 rounded-full bg-white/25" />
            </div>
            {captions && <div className="absolute inset-x-6 bottom-4 rounded-md bg-black/55 py-1 text-center text-[10px] text-white">word-by-word captions</div>}
            <div className="absolute top-2.5 right-2.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white tabular-nums">0:{String(duration).padStart(2, "0")}</div>
          </div>

          <dl className="space-y-2.5 text-sm">
            {[
              ["Length", `${duration} seconds`],
              ["Format", `${FORMATS[format].name} ${format}`],
              ["Language", languageName(language)],
              ["Style", MOODS.find((m) => m.value === mood)!.label],
              ["Captions", captions ? "On" : "Off"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Voice</dt>
              <dd className="flex items-center gap-2">
                {chosen ? (
                  <>
                    <VoiceAvatar voice={chosen} size={22} badge={false} />
                    {voiceName(chosen)}
                  </>
                ) : (
                  "Director's pick"
                )}
              </dd>
            </div>
          </dl>

          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="group h-12 w-full rounded-xl text-base" disabled={pending || prompt.trim().length < 3}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {pending ? "Starting…" : "Generate video"}
            {!pending && <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {videosLeft === null ? "Pro: no video limit" : `${videosLeft} free ${videosLeft === 1 ? "video" : "videos"} left this month`} · you can edit everything before rendering
          </p>
        </div>
      </aside>
    </form>
  );
}
