import type {
  BaseColumn,
  Borough,
  ColorBy,
  Company,
  DateRange,
  Dimension,
  Granularity,
  SeriesDimension,
  Service,
} from "@ny-dashboard/shared";

import type { Db } from "../lib/prisma";

/** Dimension filters already resolved by the service (services = applicable services). */
export interface TripFilters {
  services: Service[];
  companies: Company[];
  boroughs: Borough[];
  zones: number[];
}

export interface SeriesQuery {
  granularity: Granularity;
  range: DateRange;
  filters: TripFilters;
  groupBy?: SeriesDimension;
  columns: readonly BaseColumn[];
}

export interface ProjectionQuery {
  granularity: Exclude<Granularity, "hour">;
  range: DateRange;
  services: Service[];
  boroughs: Borough[];
  groupBy?: "service" | "borough";
  columns: readonly BaseColumn[];
}

export type Sums = Partial<Record<BaseColumn, number | null>>;

/** One aggregated bucket: `bucket` is a date/hour key, `group` a dimension value or "total". */
export interface BucketRow {
  bucket: string;
  group: string;
  sums: Sums;
}

/** Aggregated reads over the trip tables (the "M" of the query endpoints). */
export interface BreakdownQuery {
  range: DateRange;
  filters: TripFilters;
  dimensions: readonly Dimension[];
  columns: readonly BaseColumn[];
}

export interface ProjectionBreakdownQuery {
  range: DateRange;
  services: Service[];
  boroughs: Borough[];
  dimension: "service" | "borough";
  columns: readonly BaseColumn[];
}

/** Aggregated sums per combination of dimension values (`keys` follow `dimensions`). */
export interface KeyedRow {
  keys: string[];
  sums: Sums;
}

export interface QueryRepository {
  series(query: SeriesQuery): Promise<BucketRow[]>;
  projection(query: ProjectionQuery): Promise<BucketRow[]>;
  breakdown(query: BreakdownQuery): Promise<KeyedRow[]>;
  projectionBreakdown(query: ProjectionBreakdownQuery): Promise<KeyedRow[]>;
  /** Positioned trips of the sample (zones without geometry are excluded). */
  samplePoints(query: SamplePointsQuery): Promise<SamplePoints>;
  /** Trip sample values for scatter/bubble charts. */
  sampleTrips(query: SampleTripsQuery): Promise<SampleTrips>;
}

/** Columns of trip_sample usable as scatter/bubble axes. */
export type SampleColumn =
  "distance_mi" | "duration_s" | "fare" | "tips" | "revenue" | "wait_s";

export interface SampleTripsQuery {
  range: DateRange;
  filters: TripFilters;
  x: SampleColumn;
  y: SampleColumn;
  r?: SampleColumn;
  colorBy: ColorBy;
  /** Pickup hour window, inclusive; from > to wraps around midnight. */
  hours?: { from: number; to: number };
}

export interface SampleTrips {
  x: number[];
  y: number[];
  r: number[] | null;
  category: string[];
}

export interface SamplePointsQuery {
  range: DateRange;
  filters: TripFilters;
  colorBy: ColorBy;
}

/** Columnar sample points; `category` holds the service or company of each point. */
export interface SamplePoints {
  lon: number[];
  lat: number[];
  category: string[];
}

/** Columns available in od_flow_monthly (route breakdowns). */
export const ROUTE_COLUMNS: readonly BaseColumn[] = [
  "trips",
  "revenue",
  "distance_mi",
  "duration_s",
];

/** Table a breakdown reads from, decided by its dimensions. */
export const breakdownSource = (
  dimensions: readonly Dimension[],
): "daily" | "hourly" | "od" =>
  dimensions.includes("route")
    ? "od"
    : dimensions.includes("hour_of_day")
      ? "hourly"
      : "daily";

// ── SQL building (identifiers come from whitelists; values are always parameters) ──────────

class Params {
  readonly values: unknown[] = [];
  add(value: unknown, cast: string): string {
    this.values.push(value);
    return `$${String(this.values.length)}::${cast}`;
  }
}

const dayBucketSql = (
  column: string,
  granularity: Exclude<Granularity, "hour">,
): string => {
  switch (granularity) {
    case "day":
      return `${column}::text`;
    case "week":
      return `date_trunc('week', ${column})::date::text`;
    case "month":
      return `date_trunc('month', ${column})::date::text`;
  }
};

const sumsSql = (alias: string, columns: readonly BaseColumn[]) =>
  columns.map((c) => `sum(${alias}.${c})::float8 AS ${c}`).join(", ");

const toRows = (
  columns: readonly BaseColumn[],
  rows: Record<string, unknown>[],
): BucketRow[] =>
  rows.map((row) => ({
    bucket: String(row.bucket),
    group: String(row.grp),
    sums: Object.fromEntries(
      columns.map((c) => [
        c,
        row[c] === null || row[c] === undefined ? null : Number(row[c]),
      ]),
    ),
  }));

/** SQL of `series` (exported for tests/debugging). */
export const buildSeriesSql = ({
  granularity,
  range,
  filters,
  groupBy,
  columns,
}: SeriesQuery) => {
  const p = new Params();
  const where: string[] = [];
  if (granularity === "hour") {
    if (
      filters.boroughs.length > 0 ||
      filters.zones.length > 0 ||
      groupBy === "borough"
    ) {
      throw new Error(
        "trip_hourly has no zone: borough/zone filters are not supported",
      );
    }
    where.push(`h.hour >= ${p.add(range.from, "timestamp")}`);
    where.push(`h.hour < ${p.add(range.to, "date")} + 1`);
    where.push(`h.service = ANY(${p.add(filters.services, "text[]")})`);
    if (filters.companies.length > 0) {
      where.push(`h.company = ANY(${p.add(filters.companies, "text[]")})`);
    }
    const group = groupBy ? `h.${groupBy}` : "'total'";
    return {
      sql: `SELECT to_char(h.hour, 'YYYY-MM-DD"T"HH24:MI') AS bucket, ${group} AS grp, ${sumsSql("h", columns)}
            FROM trip_hourly h WHERE ${where.join(" AND ")} GROUP BY 1, 2 ORDER BY 1, 2`,
      values: p.values,
    };
  }

  const joinZones = filters.boroughs.length > 0 || groupBy === "borough";
  where.push(
    `d.date BETWEEN ${p.add(range.from, "date")} AND ${p.add(range.to, "date")}`,
  );
  where.push(`d.service = ANY(${p.add(filters.services, "text[]")})`);
  if (filters.companies.length > 0) {
    where.push(`d.company = ANY(${p.add(filters.companies, "text[]")})`);
  }
  if (filters.boroughs.length > 0) {
    where.push(`z.borough = ANY(${p.add(filters.boroughs, "text[]")})`);
  }
  if (filters.zones.length > 0)
    where.push(`d.pu_zone_id = ANY(${p.add(filters.zones, "int[]")})`);
  const group = !groupBy
    ? "'total'"
    : groupBy === "borough"
      ? "z.borough"
      : `d.${groupBy}`;
  return {
    sql: `SELECT ${dayBucketSql("d.date", granularity)} AS bucket, ${group} AS grp, ${sumsSql("d", columns)}
          FROM trip_daily d ${joinZones ? "JOIN zones z ON z.id = d.pu_zone_id" : ""}
          WHERE ${where.join(" AND ")} GROUP BY 1, 2 ORDER BY 1, 2`,
    values: p.values,
  };
};

/** SQL of `projection`. */
export const buildProjectionSql = ({
  granularity,
  range,
  services,
  boroughs,
  groupBy,
  columns,
}: ProjectionQuery) => {
  const p = new Params();
  const where = [
    `p.date BETWEEN ${p.add(range.from, "date")} AND ${p.add(range.to, "date")}`,
    `p.service = ANY(${p.add(services, "text[]")})`,
  ];
  if (boroughs.length > 0)
    where.push(`p.borough = ANY(${p.add(boroughs, "text[]")})`);
  const group = groupBy ? `p.${groupBy}` : "'total'";
  return {
    sql: `SELECT ${dayBucketSql("p.date", granularity)} AS bucket, ${group} AS grp, ${sumsSql("p", columns)}
          FROM projection p WHERE ${where.join(" AND ")} GROUP BY 1, 2 ORDER BY 1, 2`,
    values: p.values,
  };
};

const toKeyedRows = (
  dimensions: number,
  columns: readonly BaseColumn[],
  rows: Record<string, unknown>[],
): KeyedRow[] =>
  rows.map((row) => ({
    keys: Array.from({ length: dimensions }, (_, i) =>
      String(row[`k${String(i)}`]),
    ),
    sums: Object.fromEntries(
      columns.map((c) => [
        c,
        row[c] === null || row[c] === undefined ? null : Number(row[c]),
      ]),
    ),
  }));

/** SQL of `breakdown`. */
export const buildBreakdownSql = ({
  range,
  filters,
  dimensions,
  columns,
}: BreakdownQuery) => {
  const p = new Params();
  const where: string[] = [];
  const source = breakdownSource(dimensions);

  if (source === "od") {
    const expressions: Record<string, string> = {
      route: "o.pu_zone_id::text || '>' || o.do_zone_id::text",
    };
    where.push(
      `o.month BETWEEN date_trunc('month', ${p.add(range.from, "date")})::date AND ${p.add(range.to, "date")}`,
    );
    where.push(`o.service = ANY(${p.add(filters.services, "text[]")})`);
    if (filters.companies.length > 0) {
      where.push(`o.company = ANY(${p.add(filters.companies, "text[]")})`);
    }
    if (filters.boroughs.length > 0) {
      where.push(`o.pu_borough = ANY(${p.add(filters.boroughs, "text[]")})`);
    }
    if (filters.zones.length > 0)
      where.push(`o.pu_zone_id = ANY(${p.add(filters.zones, "int[]")})`);
    const keys = dimensions.map(
      (d, i) => `${expressions[d] ?? "NULL"} AS k${String(i)}`,
    );
    return {
      sql: `SELECT ${keys.join(", ")}, ${sumsSql("o", columns)} FROM od_flow_monthly o
            WHERE ${where.join(" AND ")} GROUP BY ${dimensions.map((_, i) => String(i + 1)).join(", ")}`,
      values: p.values,
    };
  }

  if (source === "hourly") {
    const expressions: Record<string, string> = {
      service: "h.service",
      company: "h.company",
      hour_of_day: "extract(hour FROM h.hour)::int::text",
      day_of_week: "extract(isodow FROM h.hour)::int::text",
    };
    const unsupported = dimensions.filter((d) => !(d in expressions));
    if (
      unsupported.length > 0 ||
      filters.boroughs.length > 0 ||
      filters.zones.length > 0
    ) {
      throw new Error(
        "trip_hourly has no zone: borough/zone are not supported with hour_of_day",
      );
    }
    where.push(`h.hour >= ${p.add(range.from, "timestamp")}`);
    where.push(`h.hour < ${p.add(range.to, "date")} + 1`);
    where.push(`h.service = ANY(${p.add(filters.services, "text[]")})`);
    if (filters.companies.length > 0) {
      where.push(`h.company = ANY(${p.add(filters.companies, "text[]")})`);
    }
    const keys = dimensions.map(
      (d, i) => `${expressions[d] ?? "NULL"} AS k${String(i)}`,
    );
    return {
      sql: `SELECT ${keys.join(", ")}, ${sumsSql("h", columns)} FROM trip_hourly h
            WHERE ${where.join(" AND ")} GROUP BY ${dimensions.map((_, i) => String(i + 1)).join(", ")}`,
      values: p.values,
    };
  }

  const expressions: Record<string, string> = {
    service: "d.service",
    company: "d.company",
    borough: "z.borough",
    zone: "d.pu_zone_id::text",
    day_of_week: "extract(isodow FROM d.date)::int::text",
  };
  const joinZones =
    filters.boroughs.length > 0 || dimensions.includes("borough");
  where.push(
    `d.date BETWEEN ${p.add(range.from, "date")} AND ${p.add(range.to, "date")}`,
  );
  where.push(`d.service = ANY(${p.add(filters.services, "text[]")})`);
  if (filters.companies.length > 0) {
    where.push(`d.company = ANY(${p.add(filters.companies, "text[]")})`);
  }
  if (filters.boroughs.length > 0) {
    where.push(`z.borough = ANY(${p.add(filters.boroughs, "text[]")})`);
  }
  if (filters.zones.length > 0)
    where.push(`d.pu_zone_id = ANY(${p.add(filters.zones, "int[]")})`);
  const keys = dimensions.map(
    (d, i) => `${expressions[d] ?? "NULL"} AS k${String(i)}`,
  );
  return {
    sql: `SELECT ${keys.join(", ")}, ${sumsSql("d", columns)} FROM trip_daily d
          ${joinZones ? "JOIN zones z ON z.id = d.pu_zone_id" : ""}
          WHERE ${where.join(" AND ")} GROUP BY ${dimensions.map((_, i) => String(i + 1)).join(", ")}`,
    values: p.values,
  };
};

/** SQL of `projectionBreakdown`. */
export const buildProjectionBreakdownSql = ({
  range,
  services,
  boroughs,
  dimension,
  columns,
}: ProjectionBreakdownQuery) => {
  const p = new Params();
  const where = [
    `p.date BETWEEN ${p.add(range.from, "date")} AND ${p.add(range.to, "date")}`,
    `p.service = ANY(${p.add(services, "text[]")})`,
  ];
  if (boroughs.length > 0)
    where.push(`p.borough = ANY(${p.add(boroughs, "text[]")})`);
  return {
    sql: `SELECT p.${dimension} AS k0, ${sumsSql("p", columns)} FROM projection p
          WHERE ${where.join(" AND ")} GROUP BY 1`,
    values: p.values,
  };
};

/** Filters shared by the sample queries (`s` = trip_sample, `z` = zones). */
const sampleWhere = (p: Params, range: DateRange, filters: TripFilters) => {
  const where = [
    `s.pickup_at >= ${p.add(range.from, "timestamp")}`,
    `s.pickup_at < ${p.add(range.to, "date")} + 1`,
    `s.service = ANY(${p.add(filters.services, "text[]")})`,
  ];
  if (filters.companies.length > 0) {
    where.push(`s.company = ANY(${p.add(filters.companies, "text[]")})`);
  }
  if (filters.boroughs.length > 0) {
    where.push(`z.borough = ANY(${p.add(filters.boroughs, "text[]")})`);
  }
  if (filters.zones.length > 0)
    where.push(`s.pu_zone_id = ANY(${p.add(filters.zones, "int[]")})`);
  return {
    where,
    join:
      filters.boroughs.length > 0 ? "JOIN zones z ON z.id = s.pu_zone_id" : "",
  };
};

/**
 * SQL of `samplePoints`: aggregates into three arrays in Postgres, so up to ~1M points come
 * back as a single row instead of a million objects.
 */
export const buildSamplePointsSql = ({
  range,
  filters,
  colorBy,
}: SamplePointsQuery) => {
  const p = new Params();
  const { where, join } = sampleWhere(p, range, filters);
  where.push("s.lon IS NOT NULL");
  return {
    sql: `SELECT coalesce(array_agg(s.lon ORDER BY s.sample_id), '{}') AS lon,
                 coalesce(array_agg(s.lat ORDER BY s.sample_id), '{}') AS lat,
                 coalesce(array_agg(s.${colorBy} ORDER BY s.sample_id), '{}') AS category
          FROM trip_sample s ${join} WHERE ${where.join(" AND ")}`,
    values: p.values,
  };
};

const SAMPLE_COLUMNS: ReadonlySet<string> = new Set([
  "distance_mi",
  "duration_s",
  "fare",
  "tips",
  "revenue",
  "wait_s",
]);

/** SQL of `sampleTrips` (array_agg, like samplePoints). Rows missing any axis are skipped. */
export const buildSampleTripsSql = ({
  range,
  filters,
  x,
  y,
  r,
  colorBy,
  hours,
}: SampleTripsQuery) => {
  for (const column of [x, y, r]) {
    if (column !== undefined && !SAMPLE_COLUMNS.has(column)) {
      throw new Error(`Unknown sample column ${column}`);
    }
  }
  const p = new Params();
  const { where, join } = sampleWhere(p, range, filters);
  for (const column of [x, y, r])
    if (column) where.push(`s.${column} IS NOT NULL`);
  if (hours) {
    const hour = "extract(hour FROM s.pickup_at)";
    const from = p.add(hours.from, "int");
    const to = p.add(hours.to, "int");
    where.push(
      hours.from <= hours.to
        ? `${hour} BETWEEN ${from} AND ${to}`
        : `(${hour} >= ${from} OR ${hour} <= ${to})`,
    );
  }
  const agg = (expression: string) =>
    `coalesce(array_agg(${expression} ORDER BY s.sample_id), '{}')`;
  return {
    sql: `SELECT ${agg(`s.${x}::float8`)} AS x, ${agg(`s.${y}::float8`)} AS y,
                 ${r ? agg(`s.${r}::float8`) : "NULL"} AS r, ${agg(`s.${colorBy}`)} AS category
          FROM trip_sample s ${join} WHERE ${where.join(" AND ")}`,
    values: p.values,
  };
};

export const createPrismaQueryRepository = (prisma: Db): QueryRepository => ({
  async sampleTrips(query) {
    const { sql, values } = buildSampleTripsSql(query);
    const [row] = await prisma.$queryRawUnsafe<
      { x: number[]; y: number[]; r: number[] | null; category: string[] }[]
    >(sql, ...values);
    return {
      x: row?.x ?? [],
      y: row?.y ?? [],
      r: query.r ? (row?.r ?? []) : null,
      category: row?.category ?? [],
    };
  },
  async samplePoints(query) {
    const { sql, values } = buildSamplePointsSql(query);
    const [row] = await prisma.$queryRawUnsafe<
      { lon: number[]; lat: number[]; category: string[] }[]
    >(sql, ...values);
    return {
      lon: row?.lon ?? [],
      lat: row?.lat ?? [],
      category: row?.category ?? [],
    };
  },
  async breakdown(query) {
    const { sql, values } = buildBreakdownSql(query);
    return toKeyedRows(
      query.dimensions.length,
      query.columns,
      await prisma.$queryRawUnsafe(sql, ...values),
    );
  },
  async projectionBreakdown(query) {
    const { sql, values } = buildProjectionBreakdownSql(query);
    return toKeyedRows(
      1,
      query.columns,
      await prisma.$queryRawUnsafe(sql, ...values),
    );
  },
  async series(query) {
    const { sql, values } = buildSeriesSql(query);
    return toRows(query.columns, await prisma.$queryRawUnsafe(sql, ...values));
  },
  async projection(query) {
    const { sql, values } = buildProjectionSql(query);
    return toRows(query.columns, await prisma.$queryRawUnsafe(sql, ...values));
  },
});
