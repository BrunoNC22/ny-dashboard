import type { Pool, PoolClient } from "pg";

import type { Db } from "../lib/prisma";
import { ensureDemoUser } from "./demo";
import { copySnapshotTable, loadZones } from "./load";
import { loadManifest, TABLE_TARGETS } from "./manifest";

/** Tables replaced by the seed (users, preferences and dashboards are never touched). */
export const DATA_TABLES = [
  "zones",
  "trip_daily",
  "trip_hourly",
  "od_flow_monthly",
  "trip_sample",
  "projection",
] as const;

export interface SeedOptions {
  pool: Pool;
  prisma: Db;
  snapshotDir: string;
  zonesDir: string;
  /** Reload the data even if this snapshot was already seeded. */
  force?: boolean;
  /** Extra work inside the data transaction (projections, #19). */
  afterLoad?: (
    client: PoolClient,
    log: (message: string) => void,
  ) => Promise<void>;
  log?: (message: string) => void;
}

export interface SeedResult {
  /** "skipped": this snapshot was already loaded (`--if-empty`). */
  data: "loaded" | "skipped";
  demoUserCreated: boolean;
  rows: Record<string, number>;
  seconds: number;
}

const SNAPSHOT_KEY = "snapshot_sha256";

const readMeta = async (
  client: PoolClient,
  key: string,
): Promise<string | undefined> => {
  const { rows } = await client.query<{ value: string }>(
    "SELECT value FROM seed_meta WHERE key = $1",
    [key],
  );
  return rows[0]?.value;
};

/** Upserts seed_meta entries (sequentially: a pg client runs one query at a time). */
const writeMeta = async (
  client: PoolClient,
  entries: Record<string, string>,
): Promise<void> => {
  for (const [key, value] of Object.entries(entries)) {
    await client.query(
      `INSERT INTO seed_meta (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
  }
};

/**
 * Loads the versioned snapshot into PostgreSQL and ensures the demo user exists.
 *
 * Idempotent: if `seed_meta` already records this snapshot's checksum, the data load is skipped
 * (unless `force`). A different snapshot (e.g. after a monthly update) is reloaded. The data
 * tables are replaced inside one transaction, so a failure leaves the previous data intact.
 */
export const runSeed = async ({
  pool,
  prisma,
  snapshotDir,
  zonesDir,
  force = false,
  afterLoad,
  log = console.log,
}: SeedOptions): Promise<SeedResult> => {
  const started = performance.now();
  const elapsed = () => ((performance.now() - started) / 1000).toFixed(1);
  const { manifest, checksum } = await loadManifest(snapshotDir);
  log(
    `seed       snapshot ${manifest.period.from} → ${manifest.period.to} (checksums ok)`,
  );

  const rows: Record<string, number> = {};
  const client = await pool.connect();
  let data: SeedResult["data"] = "skipped";
  try {
    const seeded = await readMeta(client, SNAPSHOT_KEY);
    if (!force && seeded === checksum) {
      log(
        "seed       data already loaded for this snapshot (use --force to reload)",
      );
    } else {
      if (seeded && seeded !== checksum)
        log("seed       snapshot changed: reloading data");
      await client.query("BEGIN");
      try {
        await client.query(`TRUNCATE ${DATA_TABLES.join(", ")}`);
        rows.zones = await loadZones(client, zonesDir);
        log(`seed       zones: ${String(rows.zones)} rows (${elapsed()} s)`);
        for (const [source, target] of Object.entries(TABLE_TARGETS)) {
          const table = manifest.tables[source];
          if (!table) continue;
          rows[target] = await copySnapshotTable(
            client,
            snapshotDir,
            table,
            target,
          );
          if (rows[target] !== table.rows) {
            throw new Error(
              `${target}: loaded ${String(rows[target])} rows, manifest says ${String(table.rows)}`,
            );
          }
          log(
            `seed       ${target}: ${rows[target].toLocaleString("en-US")} rows (${elapsed()} s)`,
          );
        }
        if (afterLoad) await afterLoad(client, log);
        await writeMeta(client, {
          [SNAPSHOT_KEY]: checksum,
          snapshot_period: `${manifest.period.from}/${manifest.period.to}`,
          snapshot_generated_at: manifest.generatedAt,
          seeded_at: new Date().toISOString(),
        });
        await client.query("COMMIT");
        data = "loaded";
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      // Fresh statistics for the query planner after a bulk load.
      await client.query(`ANALYZE ${DATA_TABLES.join(", ")}`);
    }
  } finally {
    client.release();
  }

  const demoUserCreated = await ensureDemoUser(prisma);
  log(
    `seed       demo user ${demoUserCreated ? "created (demo / demo1234)" : "already exists"}`,
  );
  const seconds = Number(elapsed());
  log(`seed       done in ${String(seconds)} s`);
  return { data, demoUserCreated, rows, seconds };
};
