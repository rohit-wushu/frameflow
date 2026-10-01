import type { PrismaClient } from "./generated/client";

// Limits per account tier. Free: a number of videos a month (a video counts once, however often it is
// re-rendered), with a cap on renders so edits stay reasonable. Every render counts towards that cap (a chat
// edit renders a new version). Director calls (new plans and chat edits) are limited per day. Failed jobs don't count.
export function limitsFor(tier: string) {
  const num = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    videosPerMonth: tier === "pro" ? null : num("FREE_VIDEOS_PER_MONTH", 5), // null = no video limit, only renders
    rendersPerMonth: tier === "pro" ? num("PRO_RENDERS_PER_MONTH", 200) : num("FREE_RENDERS_PER_MONTH", 25),
    aiCallsPerDay: num("AI_CALLS_PER_DAY", 40),
  };
}

// "pro" counts only until proUntil (a paid pass runs out); null = no end date (given by an admin).
export function effectiveTier(user: { tier: string; proUntil?: Date | null }, now = new Date()): string {
  if (user.tier === "pro" && user.proUntil && user.proUntil <= now) return "free";
  return user.tier;
}

export interface Usage {
  videos: number; // videos rendered this month (each counted once)
  videosLimit: number | null;
  videoIds: string[]; // their project ids: re-rendering one of them doesn't use up another video
  renders: number;
  rendersLimit: number;
  aiCalls: number;
  aiCallsLimit: number;
  resetsOn: Date; // first day of next month (UTC)
}

export async function usageFor(prisma: PrismaClient, user: { id: string; tier: string; proUntil?: Date | null }, now = new Date()): Promise<Usage> {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const day = new Date(now.getTime() - 24 * 3600 * 1000);
  const [renders, aiCalls, videos] = await Promise.all([
    prisma.job.count({ where: { userId: user.id, kind: "render", status: { not: "failed" }, createdAt: { gte: month } } }),
    prisma.job.count({ where: { userId: user.id, kind: { in: ["direct", "chat"] }, status: { not: "failed" }, createdAt: { gte: day } } }),
    prisma.job.groupBy({ by: ["projectId"], where: { userId: user.id, kind: "render", status: { not: "failed" }, createdAt: { gte: month } } }),
  ]);
  const limits = limitsFor(effectiveTier(user, now));
  return {
    videos: videos.length,
    videosLimit: limits.videosPerMonth,
    videoIds: videos.map((v) => v.projectId),
    renders,
    rendersLimit: limits.rendersPerMonth,
    aiCalls,
    aiCallsLimit: limits.aiCallsPerDay,
    resetsOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

// Why a render can't start, or null. `projectId`: the video being rendered (a video already rendered this month
// doesn't count again); "new" for one that doesn't exist yet.
export function renderBlocked(u: Usage, projectId: string, count = 1): string | null {
  const reset = u.resetsOn.toISOString().slice(0, 10);
  const newVideos = u.videoIds.includes(projectId) ? 0 : count;
  if (u.videosLimit !== null && newVideos && u.videos + newVideos > u.videosLimit)
    return `You have made ${u.videos} of your ${u.videosLimit} free videos this month (resets ${reset}). Upgrade to Pro for more.`;
  if (u.renders + count > u.rendersLimit) return `You have used all ${u.rendersLimit} renders for this month (resets ${reset}).`;
  return null;
}
