import {
  applicableServices,
  type BreakdownRequest,
  type BreakdownResponse,
  type BreakdownRow,
  computeMetric,
  type Dimension,
  dimensionValueLabel,
  metricColumns,
  type MetricId,
  METRICS,
} from "@ny-dashboard/shared";

import { badRequest } from "../lib/errors";
import { comparisonRange, wholeMonths } from "../lib/periods";
import {
  breakdownSource,
  type KeyedRow,
  type QueryRepository,
  ROUTE_COLUMNS,
  type Sums,
  type TripFilters,
} from "../models/queryRepository";
import { addSums, deltaPct } from "./timeseriesService";

export const BREAKDOWN_NOTICES = {
  routeMetric:
    "Para rotas há apenas corridas, receita, distância e duração: esta métrica não está disponível.",
  routeMonths:
    "Rotas são agregadas por mês: o período foi ampliado para meses inteiros.",
  projectionUnavailable:
    "Projeção disponível só por serviço ou distrito, sem filtro de empresa ou zona.",
} as const;

/** Zone id → name (from the zones table). */
export type ZoneNames = () => Promise<ReadonlyMap<number, string>>;

const keyOf = (keys: string[]) => keys.join("\u0000");

const compareKeys = (a: string, b: string): number => {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb)
    ? na - nb
    : a.localeCompare(b);
};

/** Values first (nulls last), then keys, so the order is total and deterministic. */
const sortRows = (
  rows: (BreakdownRow & { sums: Sums })[],
  sortBy: "value" | "key",
  direction: "asc" | "desc",
) => {
  const sign = direction === "asc" ? 1 : -1;
  const byKeys = (a: BreakdownRow, b: BreakdownRow) => {
    for (let i = 0; i < a.keys.length; i++) {
      const c = compareKeys(a.keys[i] ?? "", b.keys[i] ?? "");
      if (c !== 0) return c;
    }
    return 0;
  };
  return [...rows].sort((a, b) => {
    if (sortBy === "key") return sign * byKeys(a, b);
    if (a.value === null || b.value === null) {
      return a.value === b.value ? byKeys(a, b) : a.value === null ? 1 : -1;
    }
    return sign * (a.value - b.value) || byKeys(a, b);
  });
};

const label = (
  dimension: Dimension,
  key: string,
  zones: ReadonlyMap<number, string>,
): string => {
  if (dimension === "zone") return zones.get(Number(key)) ?? key;
  if (dimension === "route") {
    const [from = "", to = ""] = key.split(">");
    return `${zones.get(Number(from)) ?? from} → ${zones.get(Number(to)) ?? to}`;
  }
  return dimensionValueLabel(dimension, key);
};

const routeMetricAvailable = (metric: MetricId) =>
  metricColumns(metric).every((column) => ROUTE_COLUMNS.includes(column));

export interface BreakdownService {
  query(request: BreakdownRequest): Promise<BreakdownResponse>;
}

export const createBreakdownService = (
  repo: QueryRepository,
  zoneNames: ZoneNames,
): BreakdownService => ({
  async query({ metric, dimensions, filters, comparison, sort, sortBy, topN }) {
    const unit = METRICS[metric].unit;
    const columns = metricColumns(metric);
    const services = applicableServices(metric, filters.services);
    const source = breakdownSource(dimensions);
    const base = { metric, dimensions, unit, rows: [], others: null };

    if (source === "od" && !routeMetricAvailable(metric)) {
      return {
        ...base,
        notices: [BREAKDOWN_NOTICES.routeMetric],
        notApplicable: true,
      };
    }
    if (services.length === 0)
      return { ...base, notices: [], notApplicable: true };
    if (
      source === "hourly" &&
      (filters.boroughs.length > 0 ||
        filters.zones.length > 0 ||
        dimensions.some((d) => d === "borough" || d === "zone"))
    ) {
      throw badRequest(
        "Hora do dia não pode ser combinada com distrito ou zona",
      );
    }

    const notices: string[] = [];
    if (source === "od" && wholeMonths(filters.period) === null) {
      notices.push(BREAKDOWN_NOTICES.routeMonths);
    }
    const tripFilters: TripFilters = {
      services,
      companies: filters.companies,
      boroughs: filters.boroughs,
      zones: filters.zones,
    };
    const current = await repo.breakdown({
      range: filters.period,
      filters: tripFilters,
      dimensions,
      columns,
    });

    let compared: KeyedRow[] | null = null;
    if (comparison.mode === "projection") {
      const [dimension] = dimensions;
      if (
        dimensions.length === 1 &&
        (dimension === "service" || dimension === "borough") &&
        filters.companies.length === 0 &&
        filters.zones.length === 0
      ) {
        compared = await repo.projectionBreakdown({
          range: filters.period,
          services,
          boroughs: filters.boroughs,
          dimension,
          columns,
        });
      } else {
        notices.push(BREAKDOWN_NOTICES.projectionUnavailable);
      }
    } else {
      const range = comparisonRange(filters.period, comparison);
      if (range) {
        compared = await repo.breakdown({
          range,
          filters: tripFilters,
          dimensions,
          columns,
        });
      }
    }

    const comparedByKey = new Map(
      (compared ?? []).map((row) => [keyOf(row.keys), row.sums]),
    );
    const zones = await zoneNames();
    const rows = sortRows(
      current.map(({ keys, sums }) => {
        const value = computeMetric(metric, sums);
        const comparedSums = comparedByKey.get(keyOf(keys));
        const comparisonValue = comparedSums
          ? computeMetric(metric, comparedSums)
          : null;
        return {
          keys,
          labels: keys.map((key, i) =>
            label(dimensions[i] ?? "service", key, zones),
          ),
          value,
          comparisonValue,
          deltaPct: deltaPct(value, comparisonValue),
          sums,
        };
      }),
      sortBy,
      sort,
    );

    const kept = topN === undefined ? rows : rows.slice(0, topN);
    const rest = topN === undefined ? [] : rows.slice(topN);
    const restCompared = rest
      .map((row) => comparedByKey.get(keyOf(row.keys)))
      .filter((sums): sums is Sums => sums !== undefined);

    return {
      ...base,
      notices,
      notApplicable: false,
      rows: kept.map(({ sums: _sums, ...row }) => row),
      others:
        rest.length === 0
          ? null
          : {
              value: computeMetric(
                metric,
                rest.reduce<Sums>((acc, row) => addSums(acc, row.sums), {}),
              ),
              comparisonValue:
                restCompared.length === 0
                  ? null
                  : computeMetric(
                      metric,
                      restCompared.reduce<Sums>(
                        (acc, sums) => addSums(acc, sums),
                        {},
                      ),
                    ),
            },
    };
  },
});
