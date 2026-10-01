import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/client";

export * from "./generated/client";
export * from "./limits";

// One client per process, kept on globalThis because Next.js dev reloads modules (and loads this package
// in several bundles, which must share one client and its connection pool). After `prisma generate` adds a
// model, a cached client without it is replaced once (its pool is closed).
const g = globalThis as unknown as { frameflowDb?: PrismaClient };
const delegates = Object.values(Prisma.ModelName).map((m) => m.charAt(0).toLowerCase() + m.slice(1));

export function db(): PrismaClient {
  const cached = g.frameflowDb;
  if (!cached || delegates.some((d) => !(d in cached))) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set; see .env.example");
    if (cached) void cached.$disconnect().catch(() => {});
    g.frameflowDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return g.frameflowDb!;
}
