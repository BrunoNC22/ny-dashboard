import type {
  BreakdownRequest,
  BreakdownResponse,
  CategoricalDimension,
  WidgetConfigOf,
} from "@ny-dashboard/shared";

import { categorySlot } from "../categoryOrder";
import type { EffectiveFilters } from "../resolveFilters";

export type CategoricalWidget = WidgetConfigOf<
  "doughnut" | "pie" | "radar" | "polar_area" | "bar_horizontal"
>;

/** Dimensions whose natural order is the key (hours 0→23, Monday→Sunday). */
const ORDERED: readonly CategoricalDimension[] = ["hour_of_day", "day_of_week"];
const SMALL: readonly CategoricalDimension[] = [
  "service",
  "company",
  "borough",
];

/**
 * Default number of categories before "Outros": all of them for hours, weekdays and the
 * small fixed dimensions; for zones, 6 slices in parts of a whole, 10 rows in rankings.
 */
export const defaultTopN = (widget: CategoricalWidget): number | undefined => {
  if (widget.topN !== undefined) return widget.topN;
  // Hours/weekdays keep every value; services, companies and boroughs are few and fixed.
  if (ORDERED.includes(widget.dimension) || SMALL.includes(widget.dimension)) {
    return undefined;
  }
  switch (widget.type) {
    case "bar_horizontal":
      return 10;
    case "radar":
      return 8;
    default:
      return 6;
  }
};

export interface BreakdownQuery {
  request: BreakdownRequest;
  blocked: string | null;
}

export const toBreakdownQuery = (
  widget: CategoricalWidget,
  filters: EffectiveFilters,
): BreakdownQuery => {
  const ordered = ORDERED.includes(widget.dimension);
  const topN = defaultTopN(widget);
  const { comparison, ...queryFilters } = filters;
  const hourly = widget.dimension === "hour_of_day";
  return {
    request: {
      metric: widget.metric,
      dimensions: [widget.dimension],
      filters: queryFilters,
      comparison,
      sort: ordered ? "asc" : "desc",
      sortBy: ordered ? "key" : "value",
      ...(topN === undefined ? {} : { topN }),
    },
    blocked:
      hourly && (filters.boroughs.length > 0 || filters.zones.length > 0)
        ? "Os dados por hora não têm distrito nem zona. Tire esses filtros ou divida por outra dimensão."
        : null,
  };
};

export const OTHERS_KEY = "__others";

export interface Category {
  key: string;
  label: string;
  value: number | null;
  comparisonValue: number | null;
  deltaPct: number | null;
  /** Color slot; -1 = the neutral "Outros" color. */
  slot: number;
}

const pctChange = (value: number | null, base: number | null) =>
  value === null || base === null || base === 0
    ? null
    : ((value - base) / Math.abs(base)) * 100;

/**
 * Rows → categories with a color slot. Service/company/borough keep their fixed slot (color
 * follows the entity); other dimensions take slots by position. "Outros" is always neutral.
 * Rankings and radars drop it (`withOthers: false`): the sum of everything else dwarfs the
 * ranked bars and is not a point on a radar.
 */
export const toCategories = (
  response: BreakdownResponse,
  dimension: CategoricalDimension,
  { withOthers = true }: { withOthers?: boolean } = {},
): Category[] => {
  const categories: Category[] = response.rows.map((row, i) => {
    const key = row.keys[0] ?? "";
    const fixed = categorySlot(dimension, key);
    return {
      key,
      label: row.labels[0] ?? key,
      value: row.value,
      comparisonValue: row.comparisonValue,
      deltaPct: row.deltaPct,
      slot: fixed >= 0 ? fixed : i,
    };
  });
  if (withOthers && response.others) {
    categories.push({
      key: OTHERS_KEY,
      label: "Outros",
      value: response.others.value,
      comparisonValue: response.others.comparisonValue,
      deltaPct: pctChange(
        response.others.value,
        response.others.comparisonValue,
      ),
      slot: -1,
    });
  }
  return categories;
};

/** Share of each category in the total (only meaningful for additive metrics). */
export const shareOf = (
  categories: readonly Category[],
): { total: number; share: (value: number | null) => number | null } => {
  const total = categories.reduce((sum, c) => sum + (c.value ?? 0), 0);
  return {
    total,
    share: (value) =>
      value === null || total === 0 ? null : (value / total) * 100,
  };
};

export const hasComparison = (categories: readonly Category[]): boolean =>
  categories.some((c) => c.comparisonValue !== null);
