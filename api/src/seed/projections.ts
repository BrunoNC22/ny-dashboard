import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  BASE_COLUMNS,
  type BaseColumn,
  DATA_COVERAGE,
  type Service,
} from "@ny-dashboard/shared";
import type { PoolClient } from "pg";
import { from as copyFrom } from "pg-copy-streams";

import { projectSeries } from "../lib/holtWinters";

/** Base columns that exist for each service (others stay NULL in `projection`). */
export const PROJECTED_COLUMNS: Readonly<
  Record<Service, readonly BaseColumn[]>
> = {
  yellow: BASE_COLUMNS.filter(
    (c) => !["wait_s", "wait_trips", "driver_pay", "shared_trips"].includes(c),
  ),
  green: BASE_COLUMNS.filter(
    (c) => !["wait_s", "wait_trips", "driver_pay", "shared_trips"].includes(c),
  ),
  fhvhv: BASE_COLUMNS.filter(
    (c) =>
      !["passengers", "passenger_trips", "card_trips", "cash_trips"].includes(
        c,
      ),
  ),
};

export type ProjectionKind = "backtest" | "forecast";

export interface DailySeries {
  /** Contiguous dates (YYYY-MM-DD), oldest first. */
  dates: string[];
  /** One value per date for each projected column (missing days must be 0). */
  values: Partial<Record<BaseColumn, number[]>>;
}

export interface ProjectionRow {
  date: string;
  kind: ProjectionKind;
  values: Partial<Record<BaseColumn, number>>;
}

const DAY_MS = 86_400_000;

/** Adds days to a YYYY-MM-DD date (UTC arithmetic, no time zone issues). */
export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

/** Inclusive list of dates. */
export const dateRange = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) out.push(date);
  return out;
};

/**
 * Projections for one series (CLAUDE.md §5.8):
 * - backtest: for each month M after the first one, Holt-Winters fitted only with the days
 *   before M, projecting the days of M;
 * - forecast: fitted with every day, projecting from the day after the data until `forecastUntil`.
 */
export const buildProjections = (
  series: DailySeries,
  forecastUntil: string,
  seasonLength = 7,
): ProjectionRow[] => {
  const { dates, values } = series;
  const columns = Object.keys(values) as BaseColumn[];
  const rows: ProjectionRow[] = [];
  if (dates.length === 0) return rows;

  // Index of the first day of each month after the first one.
  const monthStarts: number[] = [];
  dates.forEach((date, i) => {
    if (i > 0 && date.endsWith("-01")) monthStarts.push(i);
  });

  const project = (
    trainEnd: number,
    outDates: string[],
    kind: ProjectionKind,
  ) => {
    const projected = Object.fromEntries(
      columns.map((column) => [
        column,
        projectSeries(
          (values[column] ?? []).slice(0, trainEnd),
          outDates.length,
          {
            seasonLength,
          },
        ),
      ]),
    ) as Record<BaseColumn, number[]>;
    outDates.forEach((date, k) => {
      rows.push({
        date,
        kind,
        values: Object.fromEntries(
          columns.map((c) => [c, projected[c][k] ?? 0]),
        ),
      });
    });
  };

  monthStarts.forEach((start, m) => {
    const end = monthStarts[m + 1] ?? dates.length;
    project(start, dates.slice(start, end), "backtest");
  });

  const last = dates.at(-1) ?? "";
  if (last < forecastUntil) {
    project(
      dates.length,
      dateRange(addDays(last, 1), forecastUntil),
      "forecast",
    );
  }
  return rows;
};

const csvValue = (value: number | string | undefined): string =>
  value === undefined ? "" : String(value);

/**
 * Computes the projections per service × borough from `trip_daily` and loads them into
 * `projection` (runs inside the seed transaction, after the snapshot load).
 */
export const seedProjections = async (
  client: PoolClient,
  log: (message: string) => void = console.log,
): Promise<number> => {
  const started = performance.now();
  const { rows: bounds } = await client.query<{ first: string; last: string }>(
    "SELECT min(date)::text AS first, max(date)::text AS last FROM trip_daily",
  );
  const { first, last } = bounds[0] ?? {};
  if (!first || !last)
    throw new Error("trip_daily is empty: load the snapshot first");
  const dates = dateRange(first, last);
  const index = new Map(dates.map((date, i) => [date, i]));

  const sums = BASE_COLUMNS.map((c) => `sum(d.${c})::float8 AS ${c}`).join(
    ", ",
  );
  const { rows } = await client.query<Record<string, unknown>>(
    `SELECT d.date::text AS date, d.service, z.borough, ${sums}
     FROM trip_daily d JOIN zones z ON z.id = d.pu_zone_id
     GROUP BY 1, 2, 3`,
  );

  // service|borough → daily series (zero-filled)
  const groups = new Map<
    string,
    { service: Service; borough: string; series: DailySeries }
  >();
  for (const row of rows) {
    const service = row.service as Service;
    const borough = String(row.borough);
    const key = `${service}|${borough}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        service,
        borough,
        series: {
          dates,
          values: Object.fromEntries(
            PROJECTED_COLUMNS[service].map((c) => [
              c,
              new Array<number>(dates.length).fill(0),
            ]),
          ),
        },
      };
      groups.set(key, group);
    }
    const i = index.get(String(row.date));
    if (i === undefined) continue;
    for (const column of PROJECTED_COLUMNS[service]) {
      const series = group.series.values[column];
      if (series) series[i] = Number(row[column] ?? 0);
    }
  }

  const lines: string[] = [];
  for (const { service, borough, series } of groups.values()) {
    for (const projection of buildProjections(
      series,
      DATA_COVERAGE.forecastUntil,
    )) {
      lines.push(
        [
          projection.date,
          service,
          borough,
          projection.kind,
          ...BASE_COLUMNS.map((c) => csvValue(projection.values[c])),
        ].join(",") + "\n",
      );
    }
  }

  const columns = ["date", "service", "borough", "kind", ...BASE_COLUMNS].join(
    ", ",
  );
  await pipeline(
    Readable.from(lines),
    client.query(
      copyFrom(`COPY projection (${columns}) FROM STDIN WITH (FORMAT csv)`),
    ),
  );
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  log(
    `seed       projection: ${lines.length.toLocaleString("en-US")} rows for ${String(groups.size)} service × borough series (${seconds} s)`,
  );
  return lines.length;
};
