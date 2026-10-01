import "server-only";
import { db } from "@frameflow/db";

// Numbers for the admin overview. Days and months are counted in India time (IST, UTC+5:30).
const IST = 5.5 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;

export function istBoundaries(now = new Date()) {
  const local = new Date(now.getTime() + IST);
  const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - IST);
  const month = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - IST);
  return { today, month, week: new Date(today.getTime() - 6 * DAY), days30: new Date(now.getTime() - 30 * DAY) };
}

export async function overview() {
  const prisma = db();
  const now = new Date();
  const { today, month, week, days30 } = istBoundaries(now);
  const proActive = { tier: "pro", OR: [{ proUntil: null }, { proUntil: { gt: now } }] };
  const counted = { status: { not: "failed" as const } };
  const [
    users,
    usersToday,
    usersWeek,
    usersMonth,
    unverified,
    disabled,
    pro,
    revenueMonth,
    revenue30,
    revenueAll,
    rendersToday,
    rendersMonth,
    aiToday,
    failed24h,
    active,
    projects,
    readyVideos,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.user.count({ where: { createdAt: { gte: month } } }),
    prisma.user.count({ where: { emailVerifiedAt: null } }),
    prisma.user.count({ where: { disabledAt: { not: null } } }),
    prisma.user.count({ where: proActive }),
    prisma.payment.aggregate({ where: { status: "paid", paidAt: { gte: month } }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "paid", paidAt: { gte: days30 } }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "paid" }, _sum: { amount: true }, _count: true }),
    prisma.job.count({ where: { kind: "render", createdAt: { gte: today }, ...counted } }),
    prisma.job.count({ where: { kind: "render", createdAt: { gte: month }, ...counted } }),
    prisma.job.count({ where: { kind: { in: ["direct", "chat"] }, createdAt: { gte: today }, ...counted } }),
    prisma.job.count({ where: { status: "failed", updatedAt: { gte: new Date(now.getTime() - DAY) } } }),
    prisma.job.groupBy({ by: ["status"], where: { status: { in: ["queued", "running"] } }, _count: true }),
    prisma.project.count(),
    prisma.version.count({ where: { status: "ready" } }),
  ]);
  const jobsNow = Object.fromEntries(active.map((a) => [a.status, a._count])) as Partial<Record<"queued" | "running", number>>;
  return {
    users: { total: users, today: usersToday, week: usersWeek, month: usersMonth, unverified, disabled, pro },
    revenue: {
      month: { paise: revenueMonth._sum.amount ?? 0, count: revenueMonth._count },
      days30: { paise: revenue30._sum.amount ?? 0, count: revenue30._count },
      all: { paise: revenueAll._sum.amount ?? 0, count: revenueAll._count },
    },
    renders: { today: rendersToday, month: rendersMonth },
    aiToday,
    failed24h,
    jobsNow: { queued: jobsNow.queued ?? 0, running: jobsNow.running ?? 0 },
    projects,
    readyVideos,
  };
}

export type DayRow = { day: string; signups: number; renders: number; failed: number; revenue: number };

// Last `days` days (IST), newest first: sign-ups, renders (not failed), failed jobs and revenue (paise).
export async function daily(days = 14): Promise<DayRow[]> {
  const prisma = db();
  const { today } = istBoundaries();
  const since = new Date(today.getTime() - (days - 1) * DAY);
  const day = (col: string) => `to_char(("${col}" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;
  type Row = { d: string; n: bigint };
  const [signups, renders, failed, revenue] = await Promise.all([
    prisma.$queryRawUnsafe<Row[]>(`SELECT ${day("createdAt")} d, count(*) n FROM "User" WHERE "createdAt" >= $1 GROUP BY 1`, since),
    prisma.$queryRawUnsafe<Row[]>(`SELECT ${day("createdAt")} d, count(*) n FROM "Job" WHERE "kind" = 'render' AND "status" <> 'failed' AND "createdAt" >= $1 GROUP BY 1`, since),
    prisma.$queryRawUnsafe<Row[]>(`SELECT ${day("updatedAt")} d, count(*) n FROM "Job" WHERE "status" = 'failed' AND "updatedAt" >= $1 GROUP BY 1`, since),
    prisma.$queryRawUnsafe<Row[]>(`SELECT ${day("paidAt")} d, coalesce(sum("amount"), 0) n FROM "Payment" WHERE "status" = 'paid' AND "paidAt" >= $1 GROUP BY 1`, since),
  ]);
  const map = (rows: Row[]) => new Map(rows.map((r) => [r.d, Number(r.n)]));
  const [s, r, f, v] = [map(signups), map(renders), map(failed), map(revenue)];
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - i * DAY + IST).toISOString().slice(0, 10);
    return { day: d, signups: s.get(d) ?? 0, renders: r.get(d) ?? 0, failed: f.get(d) ?? 0, revenue: v.get(d) ?? 0 };
  });
}
