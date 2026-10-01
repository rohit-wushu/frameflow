import { readFile } from "node:fs/promises";
import { NoWorkerError, voiceSample } from "@frameflow/jobs";
import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { catalog, voiceInfo, voicesFor } from "@/lib/catalog";
import { allow } from "@/lib/rate-limit";
import { storagePath } from "@/lib/storage";

// A short preview of a voice for the voice picker: ?voice=<id>&lang=<language>&style=<style>.
// The worker makes it once per voice + style (cached); signed-in users only, rate-limited.
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const q = req.nextUrl.searchParams;
  const voice = voiceInfo(q.get("voice") ?? "");
  const lang = q.get("lang") ?? "en";
  const style = q.get("style") || null;
  if (!voice || !voicesFor(lang).some((v) => v.id === voice.id) || (style && !catalog.styles.includes(style))) return Response.json({ error: "unknown voice" }, { status: 400 });
  if (!(await allow(`voice-sample:${user.id}`, 60, 3600))) return Response.json({ error: "Too many previews; try again later" }, { status: 429 });
  let key: string;
  try {
    key = await voiceSample({ voiceId: voice.id, style: voice.engine === "indic-parler" ? style : null, language: lang });
  } catch (e) {
    const message = (e as Error).message;
    console.error(`voice preview ${voice.id} failed: ${message}`);
    let error = `Couldn't make a preview: ${message.split("\n")[0].slice(0, 200)}`;
    if (e instanceof NoWorkerError) error = "Voice previews need the worker. Start it with `pnpm dev` (or `pnpm worker`).";
    // the first preview loads the voice model (and an Indic voice may still be downloading)
    else if (/timed out|timeout/i.test(message)) error = "The voice is warming up. Try again in a minute.";
    else if (/HF_TOKEN|gated|hugging ?face|parler:setup|Indic voices service/i.test(message))
      error = "Natural (Indic) voices aren't set up on this server yet: add HF_TOKEN to .env and run `pnpm parler:setup`.";
    else if (/audio:setup/i.test(message)) error = "The audio service isn't set up: run `pnpm audio:setup`.";
    else if (/exited while starting|did not become healthy/i.test(message)) error = "The audio service didn't start: see storage/audio-service.log.";
    else if (/not reachable/i.test(message)) error = "The audio service isn't reachable: check that it's running (pnpm audio:start) and AUDIO_SERVICE_URL.";
    return Response.json({ error }, { status: 503 });
  }
  return new Response(new Uint8Array(await readFile(storagePath(key))), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=86400" } });
}
