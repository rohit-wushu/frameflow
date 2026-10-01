import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// DATABASE_URL lives in the repo's .env (never logged)
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
