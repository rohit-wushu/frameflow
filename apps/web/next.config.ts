import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { NextConfig } from "next";

// The repo root holds .env (keys, DATABASE_URL, REDIS_URL) and storage/.
function repoRoot(from = process.cwd()): string {
  let dir = resolve(from);
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error("could not find the repo root (pnpm-workspace.yaml)");
    dir = up;
  }
  return dir;
}
const root = repoRoot();
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));

const nextConfig: NextConfig = {
  env: { FRAMEFLOW_STORAGE: resolve(root, process.env.STORAGE_DIR ?? "storage") },
  transpilePackages: ["@frameflow/db", "@frameflow/jobs", "@frameflow/scene-schema"],
  serverExternalPackages: ["bullmq", "ioredis", "pg", "@prisma/adapter-pg", "@prisma/client"],
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "4mb" }, // logo uploads
  },
};

export default nextConfig;
