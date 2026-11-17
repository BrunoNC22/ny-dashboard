import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import pg from "pg";
import type { TestProject } from "vitest/node";

import { API_ROOT, ZONES_DIR } from "../lib/paths";
import { createPrisma } from "../lib/prisma";
import { seedProjections } from "../seed/projections";
import { runSeed } from "../seed/run";
import { writeFixtureSnapshot } from "./snapshotFixture";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
    snapshotDir: string;
  }
}

/**
 * Test database: TEST_DATABASE_URL, or DATABASE_URL with the database name suffixed by "_test".
 * It is dropped and recreated on every run.
 */
const resolveTestUrl = (): string => {
  const dotenv = join(API_ROOT, "..", ".env");
  if (
    !process.env.DATABASE_URL &&
    !process.env.TEST_DATABASE_URL &&
    existsSync(dotenv)
  ) {
    process.loadEnvFile(dotenv);
  }
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base)
    throw new Error(
      "Set TEST_DATABASE_URL or DATABASE_URL for the integration tests",
    );
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  return url.toString();
};

export default async function setup(project: TestProject) {
  const databaseUrl = resolveTestUrl();
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]+$/i.test(database) || !database.endsWith("_test")) {
    throw new Error(
      `Refusing to reset "${database}": the test database name must end with _test`,
    );
  }

  // Recreate the database through the maintenance DB.
  const admin = new URL(databaseUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  // Load the fixture snapshot through the real seed (COPY + projections + demo user).
  const snapshotDir = await mkdtemp(join(tmpdir(), "ny-dashboard-snapshot-"));
  await writeFixtureSnapshot(snapshotDir);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = createPrisma(databaseUrl);
  try {
    await runSeed({
      pool,
      prisma,
      snapshotDir,
      zonesDir: ZONES_DIR,
      afterLoad: seedProjections,
      log: () => undefined,
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  project.provide("databaseUrl", databaseUrl);
  project.provide("snapshotDir", snapshotDir);
  return async () => {
    await rm(snapshotDir, { recursive: true, force: true });
  };
}
