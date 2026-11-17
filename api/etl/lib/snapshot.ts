import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { type Duck, sqlString } from "./duckdb";
import { addMonths, type Month, monthRange, nextMonth } from "./months";

/** Version of the snapshot file format (bump on breaking changes; read by the seed). */
export const SNAPSHOT_FORMAT_VERSION = 1;
/** GitHub rejects files > 100 MB; keep a safe margin (CLAUDE.md §5.3). */
export const MAX_CHUNK_BYTES = 45 * 1024 * 1024;
/** Target size when a table has to be split. */
export const TARGET_CHUNK_BYTES = 35 * 1024 * 1024;

type Rounding = Record<string, string>;

interface TableExport {
  table: string;
  /** Date/timestamp column used to restrict the export to the period. */
  periodColumn: string;
  /** Deterministic row order (reproducible files). */
  orderBy: string;
  /** Column → SQL expression (rounding keeps the CSV small; sums are exact enough). */
  rounding: Rounding;
}

const money = (col: string) => `round(${col}, 2)`;
const integer = (col: string) => `round(${col})::BIGINT`;

const METRIC_ROUNDING: Rounding = {
  passengers: integer("passengers"),
  revenue: money("revenue"),
  fare: money("fare"),
  tips: money("tips"),
  distance_mi: money("distance_mi"),
  duration_s: integer("duration_s"),
  cbd_fee: money("cbd_fee"),
  wait_s: integer("wait_s"),
  driver_pay: money("driver_pay"),
};

export const SNAPSHOT_TABLES: TableExport[] = [
  {
    table: "agg_daily_zone",
    periodColumn: "date",
    orderBy: "date, service, company, pu_zone_id",
    rounding: METRIC_ROUNDING,
  },
  {
    table: "agg_hourly",
    periodColumn: "hour",
    orderBy: "hour, service, company",
    rounding: METRIC_ROUNDING,
  },
  {
    table: "agg_od_monthly",
    periodColumn: "month",
    orderBy:
      "month, service, company, pu_borough, trips DESC, pu_zone_id, do_zone_id",
    rounding: {
      revenue: money("revenue"),
      distance_mi: money("distance_mi"),
      duration_s: integer("duration_s"),
    },
  },
  {
    table: "trip_sample",
    periodColumn: "pickup_at",
    orderBy: "sample_id",
    rounding: {
      distance_mi: money("distance_mi"),
      duration_s: integer("duration_s"),
      fare: money("fare"),
      tips: money("tips"),
      revenue: money("revenue"),
      wait_s: integer("wait_s"),
      lon: "round(lon, 5)",
      lat: "round(lat, 5)",
    },
  },
];

export interface ChunkInfo {
  file: string;
  rows: number;
  bytes: number;
  sha256: string;
}

export interface Manifest {
  formatVersion: number;
  generatedAt: string;
  period: { from: Month; to: Month };
  sampleMonth: string | null;
  sources: {
    month: string;
    service: string;
    read: number;
    kept: number;
    discarded: unknown;
  }[];
  tables: Record<
    string,
    {
      rows: number;
      columns: { name: string; type: string }[];
      files: ChunkInfo[];
    }
  >;
  totalBytes: number;
}

const sha256 = (path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => {
        resolve(hash.digest("hex"));
      })
      .on("error", reject);
  });

/** Latest month present in the store and the period of `months` months ending there. */
export const defaultPeriod = async (
  duck: Duck,
  months = 24,
): Promise<{ from: Month; to: Month }> => {
  const [row] = await duck.all<{ to: string | null }>(
    'SELECT max(month) AS "to" FROM etl_sources',
  );
  if (!row?.to) throw new Error("The ETL store is empty: run `pnpm etl` first");
  const to = row.to as Month;
  return { from: addMonths(to, 1 - months), to };
};

/**
 * Exports the store tables for `period` as gzip CSV chunks (≤ 45 MB each) plus `manifest.json`
 * into `dir`, replacing previous snapshot files. Output is deterministic for the same data.
 */
export interface ExportOptions {
  dir: string;
  period: { from: Month; to: Month };
  log?: (message: string) => void;
  maxChunkBytes?: number;
  targetChunkBytes?: number;
}

export const exportSnapshot = async (
  duck: Duck,
  {
    dir,
    period,
    log = console.log,
    maxChunkBytes = MAX_CHUNK_BYTES,
    targetChunkBytes = TARGET_CHUNK_BYTES,
  }: ExportOptions,
): Promise<Manifest> => {
  const months = monthRange(period.from, period.to);
  const sources = await duck.all<Manifest["sources"][number]>(
    `SELECT month, service, read, kept, discarded::VARCHAR AS discarded FROM etl_sources
     WHERE month BETWEEN '${period.from}' AND '${period.to}' ORDER BY month, service`,
  );
  const missing = months.filter(
    (month) => !sources.some((source) => source.month === month),
  );
  if (missing.length > 0)
    throw new Error(`Months missing from the ETL store: ${missing.join(", ")}`);

  await mkdir(dir, { recursive: true });
  for (const file of await readdir(dir)) {
    if (file.endsWith(".csv.gz") || file === "manifest.json")
      await rm(join(dir, file));
  }

  const start = `TIMESTAMP '${period.from}-01 00:00:00'`;
  const end = `TIMESTAMP '${nextMonth(period.to)}-01 00:00:00'`;
  const tables: Manifest["tables"] = {};
  for (const spec of SNAPSHOT_TABLES) {
    const columns = await duck.all<{ name: string; type: string }>(
      `SELECT column_name AS name, data_type AS type FROM information_schema.columns
       WHERE table_name = '${spec.table}' ORDER BY ordinal_position`,
    );
    const select = columns
      .map(({ name }) => `${spec.rounding[name] ?? name} AS ${name}`)
      .join(", ");
    const where = `${spec.periodColumn} >= ${start} AND ${spec.periodColumn} < ${end}`;
    const [{ rows } = { rows: 0 }] = await duck.all<{ rows: number }>(
      `SELECT count(*) AS rows FROM ${spec.table} WHERE ${where}`,
    );

    const write = async (chunks: number): Promise<ChunkInfo[]> => {
      const perChunk = Math.ceil(rows / chunks);
      const infos: ChunkInfo[] = [];
      for (let i = 0; i < chunks; i++) {
        const file = `${spec.table}.${String(i).padStart(3, "0")}.csv.gz`;
        const path = join(dir, file);
        await duck.run(
          `COPY (SELECT ${select} FROM ${spec.table} WHERE ${where} ORDER BY ${spec.orderBy}
                 LIMIT ${String(perChunk)} OFFSET ${String(i * perChunk)})
           TO ${sqlString(path)} (FORMAT csv, HEADER, COMPRESSION gzip)`,
        );
        const { size } = await stat(path);
        infos.push({
          file,
          rows: Math.min(perChunk, rows - i * perChunk),
          bytes: size,
          sha256: await sha256(path),
        });
      }
      return infos;
    };

    let files = await write(1);
    const size = files[0]?.bytes ?? 0;
    if (size > maxChunkBytes) {
      for (const { file } of files) await rm(join(dir, file));
      files = await write(Math.ceil(size / targetChunkBytes));
    }
    const oversized = files.find((file) => file.bytes > maxChunkBytes);
    if (oversized) {
      throw new Error(
        `${oversized.file} is larger than ${String(maxChunkBytes)} bytes`,
      );
    }

    tables[spec.table] = { rows, columns, files };
    log(
      `snapshot   ${spec.table}: ${rows.toLocaleString("en-US")} rows, ${String(files.length)} file(s), ` +
        `${(files.reduce((sum, f) => sum + f.bytes, 0) / 1e6).toFixed(1)} MB`,
    );
  }

  const [sample] = await duck.all<{ month: string | null }>(
    `SELECT strftime(min(pickup_at), '%Y-%m') AS month FROM trip_sample WHERE pickup_at >= ${start} AND pickup_at < ${end}`,
  );
  const manifest: Manifest = {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    period,
    sampleMonth: sample?.month ?? null,
    sources: sources.map((source) => ({
      ...source,
      discarded: JSON.parse(String(source.discarded)) as unknown,
    })),
    tables,
    totalBytes: Object.values(tables).reduce(
      (sum, table) => sum + table.files.reduce((s, f) => s + f.bytes, 0),
      0,
    ),
  };
  await writeFile(
    join(dir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  log(
    `snapshot   manifest.json (total ${(manifest.totalBytes / 1e6).toFixed(1)} MB)`,
  );
  return manifest;
};
