import type {
  BaseColumn,
  Borough,
  Company,
  DateRange,
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
export interface QueryRepository {
  series(query: SeriesQuery): Promise<BucketRow[]>;
  projection(query: ProjectionQuery): Promise<BucketRow[]>;
}

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

export const createPrismaQueryRepository = (prisma: Db): QueryRepository => ({
  async series(query) {
    const { sql, values } = buildSeriesSql(query);
    return toRows(query.columns, await prisma.$queryRawUnsafe(sql, ...values));
  },
  async projection(query) {
    const { sql, values } = buildProjectionSql(query);
    return toRows(query.columns, await prisma.$queryRawUnsafe(sql, ...values));
  },
});
