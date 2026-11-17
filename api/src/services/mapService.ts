import {
  applicableServices,
  computeMetric,
  type MapRequest,
  type MapResponse,
  metricColumns,
  SERVICES,
} from "@ny-dashboard/shared";

import { comparisonRange } from "../lib/periods";
import type { QueryRepository, TripFilters } from "../models/queryRepository";
import { deltaPct } from "./timeseriesService";

/** Zones without geometry ("Unknown", "Outside of NYC"): cannot be drawn. */
export const ZONES_WITHOUT_GEOMETRY: ReadonlySet<number> = new Set([264, 265]);

/** Distinct values in first-seen order + the index of each value (columnar categories). */
export const toCategories = (
  values: string[],
): { categories: string[]; index: number[] } => {
  const positions = new Map<string, number>();
  const index = values.map((value) => {
    let position = positions.get(value);
    if (position === undefined) {
      position = positions.size;
      positions.set(value, position);
    }
    return position;
  });
  return { categories: [...positions.keys()], index };
};

export interface MapService {
  query(request: MapRequest): Promise<MapResponse>;
}

export const createMapService = (repo: QueryRepository): MapService => ({
  async query(request) {
    const { filters } = request;
    const base = {
      companies: filters.companies,
      boroughs: filters.boroughs,
      zones: filters.zones,
    };

    if (request.mode === "points") {
      // No metric: every selected service has positions.
      const services =
        filters.services.length > 0 ? filters.services : [...SERVICES];
      const points = await repo.samplePoints({
        range: filters.period,
        filters: { ...base, services },
        colorBy: request.colorBy,
      });
      const { categories, index } = toCategories(points.category);
      return {
        mode: "points",
        categories,
        columns: { lon: points.lon, lat: points.lat, category: index },
      };
    }

    const { metric } = request;
    const services = applicableServices(metric, filters.services);
    const columns = metricColumns(metric);
    const tripFilters: TripFilters = { ...base, services };

    if (request.mode === "flows") {
      if (services.length === 0) {
        return {
          mode: "flows",
          metric,
          notApplicable: true,
          columns: { from: [], to: [], value: [] },
        };
      }
      const rows = await repo.breakdown({
        range: filters.period,
        filters: tripFilters,
        dimensions: ["route"],
        columns,
      });
      const flows = rows
        .map(({ keys, sums }) => {
          const [from = 0, to = 0] = (keys[0] ?? "").split(">").map(Number);
          return { from, to, value: computeMetric(metric, sums) };
        })
        .filter(
          (flow): flow is { from: number; to: number; value: number } =>
            flow.value !== null &&
            !ZONES_WITHOUT_GEOMETRY.has(flow.from) &&
            !ZONES_WITHOUT_GEOMETRY.has(flow.to),
        )
        .sort((a, b) => b.value - a.value || a.from - b.from || a.to - b.to)
        .slice(0, request.limit);
      return {
        mode: "flows",
        metric,
        notApplicable: false,
        columns: {
          from: flows.map((f) => f.from),
          to: flows.map((f) => f.to),
          value: flows.map((f) => f.value),
        },
      };
    }

    // zones
    const empty = {
      zoneId: [],
      value: [],
      comparisonValue: null,
      deltaPct: null,
    };
    if (services.length === 0) {
      return {
        mode: "zones",
        metric,
        notApplicable: true,
        comparisonRange: null,
        columns: empty,
      };
    }
    const query = {
      filters: tripFilters,
      dimensions: ["zone" as const],
      columns,
    };
    const current = await repo.breakdown({ ...query, range: filters.period });
    // Projection exists per service × borough only: no per-zone comparison against it.
    const range = comparisonRange(filters.period, request.comparison);
    const compared = range ? await repo.breakdown({ ...query, range }) : null;
    const comparedByZone = new Map(
      (compared ?? []).map((row) => [
        Number(row.keys[0]),
        computeMetric(metric, row.sums),
      ]),
    );
    const zones = current
      .map((row) => ({
        id: Number(row.keys[0]),
        value: computeMetric(metric, row.sums),
      }))
      .sort((a, b) => a.id - b.id);
    return {
      mode: "zones",
      metric,
      notApplicable: false,
      comparisonRange: range,
      columns: {
        zoneId: zones.map((z) => z.id),
        value: zones.map((z) => z.value),
        comparisonValue: compared
          ? zones.map((z) => comparedByZone.get(z.id) ?? null)
          : null,
        deltaPct: compared
          ? zones.map((z) =>
              deltaPct(z.value, comparedByZone.get(z.id) ?? null),
            )
          : null,
      },
    };
  },
});
