import type { PrismaClient } from "./generated/client";

// Monthly limits per account tier. Every render counts (a chat edit renders a new version);
// director calls (new plans and chat edits) are limited per day. Failed jobs don't count.
export function limitsFor(tier: string) {
  const num = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    rendersPerMonth: tier === "pro" ? num("PRO_RENDERS_PER_MONTH", 200) : num("FREE_RENDERS_PER_MONTH", 10),
    aiCallsPerDay: num("AI_CALLS_PER_DAY", 40),
  };
}

// "pro" counts only until proUntil (a paid pass runs out); null = no end date (given by an admin).
export function effectiveTier(user: { tier: string; proUntil?: Date | null }, now = new Date()): string {
  if (user.tier === "pro" && user.proUntil && user.proUntil <= now) return "free";
  return user.tier;
}

export interface Usage {
  renders: number;
  rendersLimit: number;
  aiCalls: number;
  aiCallsLimit: number;
  resetsOn: Date; // first day of next month (UTC)
}

export async function usageFor(prisma: PrismaClient, user: { id: string; tier: string; proUntil?: Date | null }, now = new Date()): Promise<Usage> {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const day = new Date(now.getTime() - 24 * 3600 * 1000);
  const [renders, aiCalls] = await Promise.all([
    prisma.job.count({ where: { userId: user.id, kind: "render", status: { not: "failed" }, createdAt: { gte: month } } }),
    prisma.job.count({ where: { userId: user.id, kind: { in: ["direct", "chat"] }, status: { not: "failed" }, createdAt: { gte: day } } }),
  ]);
  const limits = limitsFor(effectiveTier(user, now));
  return {
    renders,
    rendersLimit: limits.rendersPerMonth,
    aiCalls,
    aiCallsLimit: limits.aiCallsPerDay,
    resetsOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}
