import type {
  BaseColumn,
  Borough,
  Company,
  Service,
} from "@ny-dashboard/shared";

import { dayBucket } from "../lib/periods";
import {
  breakdownSource,
  type BucketRow,
  type KeyedRow,
  type QueryRepository,
  type Sums,
} from "../models/queryRepository";

/** Pickup zone → borough for the fixtures (subset of the real lookup). */
export const ZONE_BOROUGH: Readonly<Record<number, Borough>> = {
  1: "ewr",
  48: "manhattan",
  132: "queens",
  161: "manhattan",
  230: "manhattan",
  264: "unknown",
};

export interface DailyFixture {
  date: string;
  service: Service;
  company: Company;
  zone: number;
  sums: Sums;
}

export interface HourlyFixture {
  /** YYYY-MM-DDTHH:00 */
  hour: string;
  service: Service;
  company: Company;
  sums: Sums;
}

export interface ProjectionFixture {
  date: string;
  service: Service;
  borough: Borough;
  sums: Sums;
}

export interface OdFixture {
  /** First day of the month. */
  month: string;
  service: Service;
  company: Company;
  pu: number;
  do: number;
  sums: Sums;
}

export interface QueryFixtures {
  od?: OdFixture[];
  daily?: DailyFixture[];
  hourly?: HourlyFixture[];
  projection?: ProjectionFixture[];
}

const aggregate = (
  items: { bucket: string; group: string; sums: Sums }[],
  columns: readonly BaseColumn[],
): BucketRow[] => {
  const map = new Map<string, BucketRow>();
  for (const item of items) {
    const key = `${item.bucket}|${item.group}`;
    const row = map.get(key) ?? {
      bucket: item.bucket,
      group: item.group,
      sums: {},
    };
    for (const column of columns) {
      const value = item.sums[column];
      if (value === null || value === undefined) {
        row.sums[column] ??= null;
      } else {
        row.sums[column] = (row.sums[column] ?? 0) + value;
      }
    }
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) =>
    a.bucket === b.bucket
      ? a.group.localeCompare(b.group)
      : a.bucket.localeCompare(b.bucket),
  );
};

const isoDow = (date: string): string => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return String(day === 0 ? 7 : day);
};

const aggregateKeyed = (
  items: { keys: string[]; sums: Sums }[],
  columns: readonly BaseColumn[],
): KeyedRow[] => {
  const map = new Map<string, KeyedRow>();
  for (const item of items) {
    const key = item.keys.join("|");
    const row = map.get(key) ?? { keys: item.keys, sums: {} };
    for (const column of columns) {
      const value = item.sums[column];
      if (value === null || value === undefined) row.sums[column] ??= null;
      else row.sums[column] = (row.sums[column] ?? 0) + value;
    }
    map.set(key, row);
  }
  return [...map.values()];
};

const includes = <T>(list: readonly T[], value: T) =>
  list.length === 0 || list.includes(value);

/**
 * In-memory implementation of QueryRepository over fixture rows, mirroring the SQL semantics
 * (filters, buckets, groups and sums).
 */
export const createMemoryQueryRepository = (
  fixtures: QueryFixtures = {},
): QueryRepository => ({
  series({ granularity, range, filters, groupBy, columns }) {
    if (granularity === "hour") {
      const items = (fixtures.hourly ?? [])
        .filter(
          (row) =>
            row.hour.slice(0, 10) >= range.from &&
            row.hour.slice(0, 10) <= range.to &&
            filters.services.includes(row.service) &&
            includes(filters.companies, row.company),
        )
        .map((row) => ({
          bucket: row.hour.slice(0, 16),
          group:
            groupBy === "service"
              ? row.service
              : groupBy === "company"
                ? row.company
                : "total",
          sums: row.sums,
        }));
      return Promise.resolve(aggregate(items, columns));
    }
    const items = (fixtures.daily ?? [])
      .filter((row) => {
        const borough = ZONE_BOROUGH[row.zone] ?? "unknown";
        return (
          row.date >= range.from &&
          row.date <= range.to &&
          filters.services.includes(row.service) &&
          includes(filters.companies, row.company) &&
          includes(filters.boroughs, borough) &&
          includes(filters.zones, row.zone)
        );
      })
      .map((row) => ({
        bucket: dayBucket(row.date, granularity),
        group:
          groupBy === "borough"
            ? (ZONE_BOROUGH[row.zone] ?? "unknown")
            : groupBy
              ? row[groupBy]
              : "total",
        sums: row.sums,
      }));
    return Promise.resolve(aggregate(items, columns));
  },
  projection({ granularity, range, services, boroughs, groupBy, columns }) {
    const items = (fixtures.projection ?? [])
      .filter(
        (row) =>
          row.date >= range.from &&
          row.date <= range.to &&
          services.includes(row.service) &&
          includes(boroughs, row.borough),
      )
      .map((row) => ({
        bucket: dayBucket(row.date, granularity),
        group: groupBy ? row[groupBy] : "total",
        sums: row.sums,
      }));
    return Promise.resolve(aggregate(items, columns));
  },
  breakdown({ range, filters, dimensions, columns }) {
    const source = breakdownSource(dimensions);
    if (source === "od") {
      const firstMonth = `${range.from.slice(0, 7)}-01`;
      const items = (fixtures.od ?? [])
        .filter(
          (row) =>
            row.month >= firstMonth &&
            row.month <= range.to &&
            filters.services.includes(row.service) &&
            includes(filters.companies, row.company) &&
            includes(filters.boroughs, ZONE_BOROUGH[row.pu] ?? "unknown") &&
            includes(filters.zones, row.pu),
        )
        .map((row) => ({
          keys: [`${String(row.pu)}>${String(row.do)}`],
          sums: row.sums,
        }));
      return Promise.resolve(aggregateKeyed(items, columns));
    }
    if (source === "hourly") {
      const items = (fixtures.hourly ?? [])
        .filter(
          (row) =>
            row.hour.slice(0, 10) >= range.from &&
            row.hour.slice(0, 10) <= range.to &&
            filters.services.includes(row.service) &&
            includes(filters.companies, row.company),
        )
        .map((row) => ({
          keys: dimensions.map((d) =>
            d === "hour_of_day"
              ? String(Number(row.hour.slice(11, 13)))
              : d === "day_of_week"
                ? isoDow(row.hour.slice(0, 10))
                : d === "company"
                  ? row.company
                  : row.service,
          ),
          sums: row.sums,
        }));
      return Promise.resolve(aggregateKeyed(items, columns));
    }
    const items = (fixtures.daily ?? [])
      .filter(
        (row) =>
          row.date >= range.from &&
          row.date <= range.to &&
          filters.services.includes(row.service) &&
          includes(filters.companies, row.company) &&
          includes(filters.boroughs, ZONE_BOROUGH[row.zone] ?? "unknown") &&
          includes(filters.zones, row.zone),
      )
      .map((row) => ({
        keys: dimensions.map((d) =>
          d === "borough"
            ? (ZONE_BOROUGH[row.zone] ?? "unknown")
            : d === "zone"
              ? String(row.zone)
              : d === "day_of_week"
                ? isoDow(row.date)
                : d === "company"
                  ? row.company
                  : row.service,
        ),
        sums: row.sums,
      }));
    return Promise.resolve(aggregateKeyed(items, columns));
  },
  projectionBreakdown({ range, services, boroughs, dimension, columns }) {
    const items = (fixtures.projection ?? [])
      .filter(
        (row) =>
          row.date >= range.from &&
          row.date <= range.to &&
          services.includes(row.service) &&
          includes(boroughs, row.borough),
      )
      .map((row) => ({ keys: [row[dimension]], sums: row.sums }));
    return Promise.resolve(aggregateKeyed(items, columns));
  },
});
