import { existsSync } from "node:fs";
import { join } from "node:path";

import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env by itself: use the repository root .env outside production.
const dotenv = join(import.meta.dirname, "..", ".env");
if (process.env.NODE_ENV !== "production" && existsSync(dotenv))
  process.loadEnvFile(dotenv);

export default defineConfig({
  schema: join("prisma", "schema.prisma"),
  migrations: { path: join("prisma", "migrations") },
  // `prisma generate` does not need a database; migrate/studio do.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
