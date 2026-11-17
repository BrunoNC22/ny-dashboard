/**
 * Seeds the database from the versioned snapshot and creates the demo user.
 *
 *   pnpm --filter @ny-dashboard/api db:seed [--if-empty] [--force]
 *
 * --if-empty (default): skip the data load when this snapshot is already loaded.
 * --force: reload the data even if it is already loaded. Users are never touched.
 */
import { parseArgs } from "node:util";

import pg from "pg";

import { loadEnv } from "../config/env";
import { SNAPSHOT_DIR, ZONES_DIR } from "../lib/paths";
import { createPrisma } from "../lib/prisma";
import { runSeed } from "./run";

const { values } = parseArgs({
  options: {
    force: { type: "boolean", default: false },
    "if-empty": { type: "boolean", default: true },
  },
});

const env = loadEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const prisma = createPrisma(env.DATABASE_URL);
try {
  await runSeed({
    pool,
    prisma,
    snapshotDir: SNAPSHOT_DIR,
    zonesDir: ZONES_DIR,
    force: values.force,
  });
} finally {
  await prisma.$disconnect();
  await pool.end();
}
