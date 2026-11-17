import { join } from "node:path";

import { type Duck, sqlString } from "./duckdb";
import { METRIC_COLUMNS_DDL } from "./metrics";
import type { Month } from "./months";
import { nextMonth } from "./months";
import { CACHE_DIR, ZONES_DIR } from "./paths";
import type { SourceReport } from "./pipeline";

/**
 * Persistent DuckDB database that accumulates the aggregates across ETL runs (gitignored).
 * Each step replaces the rows of the month × service it processes, so re-runs are idempotent.
 * The snapshot (#12) is exported from here.
 */
export const ETL_DB_PATH = join(CACHE_DIR, "etl.duckdb");
const ZONE_LOOKUP_PATH = join(ZONES_DIR, "taxi_zone_lookup.csv");

/** Bump when a table definition changes; tables are recreated (and must be re-filled). */
export const STORE_SCHEMA_VERSION = 1;

const TABLES = {
  etl_sources: `
    month VARCHAR NOT NULL,
    service VARCHAR NOT NULL,
    read BIGINT NOT NULL,
    kept BIGINT NOT NULL,
    discarded JSON NOT NULL,
    processed_at TIMESTAMP NOT NULL`,
  /** Daily × pickup zone × service × company (CLAUDE.md §5.6, table 1). Sums only. */
  agg_daily_zone: `
    date DATE NOT NULL,
    service VARCHAR NOT NULL,
    company VARCHAR NOT NULL,
    pu_zone_id SMALLINT NOT NULL,${METRIC_COLUMNS_DDL}`,
  /** Hour × service × company (CLAUDE.md §5.6, table 2). Sums only. */
  /**
   * Top origin → destination routes per month × service × company × pickup borough
   * (CLAUDE.md §5.6, table 3). Only the top OD_TOP_N routes of each group are kept.
   */
  agg_od_monthly: `
    month DATE NOT NULL,
    service VARCHAR NOT NULL,
    company VARCHAR NOT NULL,
    pu_borough VARCHAR NOT NULL,
    pu_zone_id SMALLINT NOT NULL,
    do_zone_id SMALLINT NOT NULL,
    trips BIGINT NOT NULL,
    revenue DOUBLE NOT NULL,
    distance_mi DOUBLE NOT NULL,
    duration_s DOUBLE NOT NULL`,
  /** Per service: the trips of the sample month ordered by a deterministic hash (top SAMPLE.size). */
  sample_candidates: `
    service VARCHAR NOT NULL,
    company VARCHAR NOT NULL,
    pickup_at TIMESTAMP NOT NULL,
    pu_zone_id SMALLINT NOT NULL,
    do_zone_id SMALLINT,
    distance_mi DOUBLE NOT NULL,
    duration_s DOUBLE NOT NULL,
    fare DOUBLE NOT NULL,
    tips DOUBLE NOT NULL,
    revenue DOUBLE NOT NULL,
    wait_s DOUBLE,
    sample_key UBIGINT NOT NULL`,
  /** Final sample with approximate positions (CLAUDE.md §5.6, table 4). */
  trip_sample: `
    sample_id INTEGER NOT NULL,
    service VARCHAR NOT NULL,
    company VARCHAR NOT NULL,
    pickup_at TIMESTAMP NOT NULL,
    pu_zone_id SMALLINT NOT NULL,
    do_zone_id SMALLINT,
    distance_mi DOUBLE NOT NULL,
    duration_s DOUBLE NOT NULL,
    fare DOUBLE NOT NULL,
    tips DOUBLE NOT NULL,
    revenue DOUBLE NOT NULL,
    wait_s DOUBLE,
    lon DOUBLE,
    lat DOUBLE`,
  agg_hourly: `
    hour TIMESTAMP NOT NULL,
    service VARCHAR NOT NULL,
    company VARCHAR NOT NULL,${METRIC_COLUMNS_DDL}`,
} as const;
export type StoreTable = keyof typeof TABLES;

/** Creates the store tables (recreating everything if the schema version changed). */
export const ensureStore = async (duck: Duck): Promise<void> => {
  await duck.run(
    "CREATE TABLE IF NOT EXISTS etl_meta (key VARCHAR PRIMARY KEY, value VARCHAR)",
  );
  const [row] = await duck.all<{ value: string }>(
    "SELECT value FROM etl_meta WHERE key = 'schema_version'",
  );
  if (row?.value !== String(STORE_SCHEMA_VERSION)) {
    for (const table of Object.keys(TABLES))
      await duck.run(`DROP TABLE IF EXISTS ${table}`);
    await duck.run(
      `INSERT OR REPLACE INTO etl_meta VALUES ('schema_version', '${String(STORE_SCHEMA_VERSION)}')`,
    );
  }
  for (const [table, columns] of Object.entries(TABLES)) {
    await duck.run(`CREATE TABLE IF NOT EXISTS ${table} (${columns})`);
  }
  await loadZones(duck);
};

/** Zone → borough id (same mapping as `toBoroughId`), from the versioned lookup CSV. */
const loadZones = (duck: Duck): Promise<void> =>
  duck.run(`
    CREATE OR REPLACE TABLE zones AS
    SELECT
      LocationID::SMALLINT AS zone_id,
      CASE WHEN Borough IN ('Unknown', 'N/A') THEN 'unknown'
           ELSE lower(replace(Borough, ' ', '_')) END AS borough
    FROM read_csv(${sqlString(ZONE_LOOKUP_PATH)}, header = true)`);

/** Replaces the rows of one month × service in a date-keyed table inside a transaction. */
export const replaceMonth = async (
  duck: Duck,
  table: StoreTable,
  dateColumn: string,
  service: string,
  month: Month,
  insertSql: string,
): Promise<void> => {
  await duck.run("BEGIN TRANSACTION");
  try {
    await duck.run(
      `DELETE FROM ${table} WHERE service = '${service}' ` +
        `AND ${dateColumn} >= DATE '${month}-01' AND ${dateColumn} < DATE '${nextMonth(month)}-01'`,
    );
    await duck.run(`INSERT INTO ${table} ${insertSql}`);
    await duck.run("COMMIT");
  } catch (error) {
    await duck.run("ROLLBACK");
    throw error;
  }
};

/** Records (replacing) the read/kept/discarded counts of one source. */
export const saveSourceReport = async (
  duck: Duck,
  report: SourceReport,
): Promise<void> => {
  await duck.run(
    `DELETE FROM etl_sources WHERE month = '${report.month}' AND service = '${report.service}'`,
  );
  await duck.run(
    `INSERT INTO etl_sources VALUES ('${report.month}', '${report.service}', ${String(report.read)}, ` +
      `${String(report.kept)}, '${JSON.stringify(report.discarded)}', now()::TIMESTAMP)`,
  );
};
