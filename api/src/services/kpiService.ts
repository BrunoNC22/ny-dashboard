import {
  applicableServices,
  type DateRange,
  type Granularity,
  type KpiRequest,
  type KpiResponse,
  metricColumns,
  METRICS,
} from "@ny-dashboard/shared";

import { evaluateKpi } from "../lib/kpiStatus";
import { comparisonRange, daysBetween } from "../lib/periods";
import type { QueryRepository, TripFilters } from "../models/queryRepository";
import { deltaPct, toSeries, totalOf } from "./timeseriesService";

/** Sparkline resolution: daily up to ~4 months, weekly beyond. */
export const sparklineGranularity = (
  range: DateRange,
): Exclude<Granularity, "hour"> =>
  daysBetween(range.from, range.to) <= 124 ? "day" : "week";

export interface KpiService {
  query(request: KpiRequest): Promise<KpiResponse>;
}

export const createKpiService = (repo: QueryRepository): KpiService => ({
  async query({ metric, filters, comparison, evaluation, sparkline }) {
    const definition = METRICS[metric];
    const columns = metricColumns(metric);
    const services = applicableServices(metric, filters.services);
    const target = evaluation.target?.value ?? null;
    if (services.length === 0) {
      return {
        metric,
        notApplicable: true,
        value: null,
        comparison: null,
        target,
        status: "neutral",
        sparkline: null,
      };
    }

    const tripFilters: TripFilters = {
      services,
      companies: filters.companies,
      boroughs: filters.boroughs,
      zones: filters.zones,
    };
    const granularity = sparklineGranularity(filters.period);
    const rows = await repo.series({
      granularity,
      range: filters.period,
      filters: tripFilters,
      columns,
    });
    const value = totalOf(metric, rows);

    let compared: KpiResponse["comparison"] = null;
    if (comparison.mode === "projection") {
      // Projection exists per service × borough only (CLAUDE.md §5.8).
      if (filters.companies.length === 0 && filters.zones.length === 0) {
        const projected = totalOf(
          metric,
          await repo.projection({
            granularity: "month",
            range: filters.period,
            services,
            boroughs: filters.boroughs,
            columns,
          }),
        );
        compared = {
          range: filters.period,
          value: projected,
          deltaAbs:
            value === null || projected === null ? null : value - projected,
          deltaPct: deltaPct(value, projected),
        };
      }
    } else {
      const range = comparisonRange(filters.period, comparison);
      if (range) {
        const previous = totalOf(
          metric,
          await repo.series({
            granularity: "month",
            range,
            filters: tripFilters,
            columns,
          }),
        );
        compared = {
          range,
          value: previous,
          deltaAbs:
            value === null || previous === null ? null : value - previous,
          deltaPct: deltaPct(value, previous),
        };
      }
    }

    return {
      metric,
      notApplicable: false,
      value,
      comparison: compared,
      target,
      status: evaluateKpi(
        value,
        compared?.deltaPct ?? null,
        evaluation,
        definition.direction,
      ),
      sparkline: sparkline
        ? (toSeries(metric, rows, filters.period, granularity)[0]?.points ??
          null)
        : null,
    };
  },
});
