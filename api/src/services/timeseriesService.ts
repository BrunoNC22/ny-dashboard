import {
  applicableServices,
  BASE_COLUMNS,
  type BaseColumn,
  computeMetric,
  type DateRange,
  type Granularity,
  metricColumns,
  type MetricId,
  METRICS,
  type Series,
  type TimeseriesRequest,
  type TimeseriesResponse,
} from "@ny-dashboard/shared";

import { badRequest } from "../lib/errors";
import { bucketsOf, comparisonRange } from "../lib/periods";
import type {
  BucketRow,
  QueryRepository,
  Sums,
  TripFilters,
} from "../models/queryRepository";

export const NOTICES = {
  projectionFilters:
    "Projeção indisponível com filtro de empresa ou zona (ela existe por serviço × distrito).",
  projectionByCompany: "A projeção não separa por empresa: exibida no total.",
} as const;

/** Adds `sums` into `target` (nulls are ignored). */
export const addSums = (target: Sums, sums: Sums): Sums => {
  for (const [column, value] of Object.entries(sums) as [
    BaseColumn,
    number | null,
  ][]) {
    if (value !== null) target[column] = (target[column] ?? 0) + value;
  }
  return target;
};

/** Metric over all rows (sum of sums, then the formula — never an average of averages). */
export const totalOf = (metric: MetricId, rows: BucketRow[]): number | null =>
  computeMetric(
    metric,
    rows.reduce<Sums>((acc, row) => addSums(acc, row.sums), {}),
  );

export const deltaPct = (
  current: number | null,
  previous: number | null,
): number | null =>
  current === null || previous === null || previous === 0
    ? null
    : (100 * (current - previous)) / Math.abs(previous);

const zeros = Object.fromEntries(BASE_COLUMNS.map((c) => [c, 0])) as Sums;

/**
 * Columnar series per group over every bucket of the range. A bucket missing for a group is 0
 * (sums) / null (ratios) when other groups have data there, and null when nobody has data
 * (outside the data coverage).
 */
export const toSeries = (
  metric: MetricId,
  rows: BucketRow[],
  range: DateRange,
  granularity: Granularity,
): Series[] => {
  const buckets = bucketsOf(range, granularity);
  const withData = new Set(rows.map((row) => row.bucket));
  const groups = [...new Set(rows.map((row) => row.group))].sort();
  return groups.map((group) => {
    const byBucket = new Map(
      rows
        .filter((row) => row.group === group)
        .map((row) => [row.bucket, row.sums]),
    );
    return {
      key: group,
      points: {
        t: buckets,
        v: buckets.map((bucket) => {
          const sums =
            byBucket.get(bucket) ?? (withData.has(bucket) ? zeros : null);
          return sums ? computeMetric(metric, sums) : null;
        }),
      },
    };
  });
};

export interface TimeseriesService {
  query(request: TimeseriesRequest): Promise<TimeseriesResponse>;
}

export const createTimeseriesService = (
  repo: QueryRepository,
): TimeseriesService => ({
  async query({
    metric,
    granularity,
    filters,
    comparison,
    groupBy,
    includeProjection,
  }) {
    const unit = METRICS[metric].unit;
    const columns = metricColumns(metric);
    const services = applicableServices(metric, filters.services);
    const empty = {
      metric,
      granularity,
      unit,
      series: [],
      comparison: null,
      projection: null,
    };
    if (services.length === 0)
      return { ...empty, notices: [], notApplicable: true };

    if (
      granularity === "hour" &&
      (filters.boroughs.length > 0 ||
        filters.zones.length > 0 ||
        groupBy === "borough")
    ) {
      throw badRequest(
        "A granularidade horária não permite filtrar ou agrupar por distrito/zona",
      );
    }

    const tripFilters: TripFilters = {
      services,
      companies: filters.companies,
      boroughs: filters.boroughs,
      zones: filters.zones,
    };
    const period = filters.period;
    const notices: string[] = [];
    const currentRows = await repo.series({
      granularity,
      range: period,
      filters: tripFilters,
      ...(groupBy ? { groupBy } : {}),
      columns,
    });

    // Projection (overlay and/or comparison), only per service × borough and ≥ day.
    const wantsProjection =
      includeProjection || comparison.mode === "projection";
    let projectionRows: BucketRow[] | null = null;
    if (wantsProjection && granularity !== "hour") {
      if (filters.companies.length > 0 || filters.zones.length > 0) {
        notices.push(NOTICES.projectionFilters);
      } else {
        if (groupBy === "company") notices.push(NOTICES.projectionByCompany);
        projectionRows = await repo.projection({
          granularity,
          range: period,
          services,
          boroughs: filters.boroughs,
          ...(groupBy === "service" || groupBy === "borough"
            ? { groupBy }
            : {}),
          columns,
        });
      }
    }

    let comparisonResult: TimeseriesResponse["comparison"] = null;
    if (comparison.mode === "projection") {
      if (projectionRows) {
        comparisonResult = {
          range: period,
          series: toSeries(metric, projectionRows, period, granularity),
          totals: {
            current: totalOf(metric, currentRows),
            comparison: totalOf(metric, projectionRows),
            deltaPct: deltaPct(
              totalOf(metric, currentRows),
              totalOf(metric, projectionRows),
            ),
          },
        };
      }
    } else {
      const range = comparisonRange(period, comparison);
      if (range) {
        const rows = await repo.series({
          granularity,
          range,
          filters: tripFilters,
          ...(groupBy ? { groupBy } : {}),
          columns,
        });
        const current = totalOf(metric, currentRows);
        const previous = totalOf(metric, rows);
        comparisonResult = {
          range,
          series: toSeries(metric, rows, range, granularity),
          totals: {
            current,
            comparison: previous,
            deltaPct: deltaPct(current, previous),
          },
        };
      }
    }

    return {
      ...empty,
      notices,
      notApplicable: false,
      series: toSeries(metric, currentRows, period, granularity),
      comparison: comparisonResult,
      projection:
        includeProjection && projectionRows
          ? { series: toSeries(metric, projectionRows, period, granularity) }
          : null,
    };
  },
});
