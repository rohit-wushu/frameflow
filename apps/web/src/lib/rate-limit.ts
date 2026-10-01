import "server-only";
import { redis } from "@frameflow/jobs";
import { headers } from "next/headers";

// Fixed-window counter in Redis. Returns false once `limit` hits happen within `windowSec`.
export async function allow(key: string, limit: number, windowSec: number): Promise<boolean> {
  const k = `frameflow:rl:${key}`;
  const n = await redis().incr(k);
  if (n === 1) await redis().expire(k, windowSec);
  return n <= limit;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
