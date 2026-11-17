import { join } from "node:path";

import type { Duck } from "./duckdb";
import type { Month } from "./months";
import { nextMonth } from "./months";
import { CACHE_DIR } from "./paths";
import type { SourceReport } from "./pipeline";

/**
 * Persistent DuckDB database that accumulates the aggregates across ETL runs (gitignored).
 * Each step replaces the rows of the month × service it processes, so re-runs are idempotent.
 * The snapshot (#12) is exported from here.
 */
export const ETL_DB_PATH = join(CACHE_DIR, "etl.duckdb");

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
    pu_zone_id SMALLINT NOT NULL,
    trips BIGINT NOT NULL,
    passengers DOUBLE,
    passenger_trips BIGINT,
    revenue DOUBLE NOT NULL,
    fare DOUBLE NOT NULL,
    tips DOUBLE NOT NULL,
    distance_mi DOUBLE NOT NULL,
    duration_s DOUBLE NOT NULL,
    airport_trips BIGINT NOT NULL,
    card_trips BIGINT,
    cash_trips BIGINT,
    cbd_fee DOUBLE NOT NULL,
    wait_s DOUBLE,
    wait_trips BIGINT,
    driver_pay DOUBLE,
    shared_trips BIGINT`,
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
};

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
