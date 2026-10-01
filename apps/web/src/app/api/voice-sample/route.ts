import { readFile } from "node:fs/promises";
import { voiceSample } from "@frameflow/jobs";
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
    // the first Indic voice of the day loads a large model
    const slow = /timed out|timeout/i.test(message);
    return Response.json({ error: slow ? "The voice is warming up. Try again in a minute." : "Couldn't make a preview right now." }, { status: 503 });
  }
  return new Response(new Uint8Array(await readFile(storagePath(key))), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=86400" } });
}
