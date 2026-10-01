"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { sendChat } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProjectState, type ProjectState } from "@/hooks/use-project-state";
import { cn } from "@/lib/utils";

type Message = ProjectState["messages"][number];

// Chat edits. In the storyboard a change only updates the plan; in the editor it renders a new version.
export function ChatPanel({
  projectId,
  initial,
  render,
  scene,
  suggestions,
  beforeSend,
  onDone,
  className,
}: {
  projectId: string;
  initial: Message[];
  render: boolean;
  scene: { id: string; label: string } | null;
  suggestions: string[];
  beforeSend?: () => Promise<boolean>; // e.g. save unsaved storyboard edits first
  onDone: () => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [pending, start] = useTransition();
  const state = useProjectState(projectId, waiting, 1200);
  const messages = state?.messages ?? initial;
  const end = useRef<HTMLDivElement>(null);
  const sawBusy = useRef(false);

  useEffect(() => {
    if (!waiting || !state) return;
    if (state.chatBusy) sawBusy.current = true;
    // done once the job is no longer queued/running (and we saw it, or an answer arrived)
    if (!state.chatBusy && (sawBusy.current || messages.length > initial.length + 1)) {
      setWaiting(false);
      sawBusy.current = false;
      onDone();
    }
  }, [state, waiting, onDone, messages.length, initial.length]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = (instruction: string) =>
    start(async () => {
      if (beforeSend && !(await beforeSend())) return;
      const r = await sendChat(projectId, { text: instruction, sceneId: scene?.id ?? null, render });
      if (!r.ok) return void toast.error(r.error ?? "Could not send");
      setText("");
      sawBusy.current = false;
      setWaiting(true);
    });

  const busy = pending || waiting;
  return (
    <div className={cn("flex min-h-0 flex-col rounded-xl border bg-card", className)}>
      <div className="border-b px-4 py-3 text-sm font-medium">Ask for changes</div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {!messages.length && <p className="text-muted-foreground">Tell the director what to change, in plain words.</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("max-w-[90%] rounded-lg px-3 py-2", m.role === "user" ? "ml-auto bg-primary/15" : "bg-muted")}>
            {m.text}
          </div>
        ))}
        {busy && <div className="w-fit animate-pulse rounded-lg bg-muted px-3 py-2 text-muted-foreground">{render ? "Changing the plan, then rendering…" : "Changing the plan…"}</div>}
        <div ref={end} />
      </div>
      <form
        className="space-y-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send(text.trim());
        }}
      >
        {scene && <div className="text-xs text-muted-foreground">About: {scene.label}</div>}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={suggestions[0] ? `e.g. "${suggestions[0]}"` : "Describe the change"}
          rows={2}
          maxLength={500}
          className="resize-none"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) send(text.trim());
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {suggestions.slice(0, 3).map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => send(s)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
              {s}
            </button>
          ))}
          <Button type="submit" size="sm" className="ml-auto" disabled={busy || !text.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
