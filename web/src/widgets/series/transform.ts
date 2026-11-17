import {
  type Comparison,
  dimensionValueLabel,
  METRICS,
  type Series,
  type TimeseriesRequest,
  type TimeseriesResponse,
  type WidgetConfigOf,
} from "@ny-dashboard/shared";

import { categorySlot, sortByCategory } from "../categoryOrder";
import type { EffectiveFilters } from "../resolveFilters";

export type SeriesWidget = WidgetConfigOf<
  "line" | "area" | "bar" | "stacked_bar"
>;

// ── Request ────────────────────────────────────────────────────────────────────

export interface SeriesQuery {
  request: TimeseriesRequest;
  /** Why the query cannot run as configured (shown instead of the chart). */
  blocked: string | null;
  /** Adjustments the widget made to a valid request (shown as notices). */
  notices: string[];
}

/**
 * Widget + effective filters → timeseries request. Hourly data has no zone, and the projection
 * only exists per day or coarser (CLAUDE.md §13, #23).
 */
export const toSeriesQuery = (
  widget: SeriesWidget,
  filters: EffectiveFilters,
): SeriesQuery => {
  const hourly = widget.granularity === "hour";
  const notices: string[] = [];
  let comparison: Comparison = filters.comparison;
  if (hourly && comparison.mode === "projection") {
    comparison = { mode: "none" };
    notices.push("A projeção não existe por hora: sem comparação.");
  }
  const { comparison: _c, ...queryFilters } = filters;
  const blocked =
    hourly && (filters.boroughs.length > 0 || filters.zones.length > 0)
      ? "Os dados por hora não têm distrito nem zona. Tire esses filtros ou use outra granularidade."
      : null;
  return {
    request: {
      metric: widget.metric,
      granularity: widget.granularity,
      filters: queryFilters,
      comparison,
      ...(widget.groupBy ? { groupBy: widget.groupBy } : {}),
      // An overlaid projection is redundant when the comparison already is the projection.
      includeProjection:
        widget.showProjection && !hourly && comparison.mode !== "projection",
    },
    blocked,
    notices,
  };
};

// ── Time ───────────────────────────────────────────────────────────────────────

/**
 * NY wall-clock timestamp ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm") → epoch ms of the same wall
 * clock in the browser's zone, so the axis shows New York times whatever the viewer's zone.
 */
export const toMillis = (t: string): number => {
  const [date = "", time = "00:00"] = t.split("T");
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
};

/** Shift that puts the comparison's first day on the current period's first day (§6.2). */
export const alignmentOffset = (
  currentFrom: string,
  comparisonFrom: string,
): number => toMillis(currentFrom) - toMillis(comparisonFrom);

export interface SeriesPoint {
  x: number;
  y: number | null;
  /** Original timestamp (comparison points are shifted on the axis). */
  t: string;
}

export const toPoints = (series: Series, offset = 0): SeriesPoint[] =>
  series.points.t.map((t, i) => ({
    x: toMillis(t) + offset,
    y: series.points.v[i] ?? null,
    t,
  }));

/** Sum of several series per timestamp (null only when every series is null). */
export const sumSeries = (series: readonly Series[]): Series => {
  const totals = new Map<string, number | null>();
  for (const s of series) {
    s.points.t.forEach((t, i) => {
      const v = s.points.v[i] ?? null;
      const prev = totals.get(t);
      totals.set(t, v === null ? (prev ?? null) : (prev ?? 0) + v);
    });
  }
  const t = [...totals.keys()].sort();
  return {
    key: "total",
    points: { t, v: t.map((k) => totals.get(k) ?? null) },
  };
};

// ── Datasets ───────────────────────────────────────────────────────────────────

export type DatasetRole = "current" | "comparison" | "projection";

export interface SeriesDataset {
  role: DatasetRole;
  /** Index of the series color (fixed order by key). */
  colorIndex: number;
  label: string;
  points: SeriesPoint[];
}

export const seriesLabel = (
  key: string,
  widget: Pick<SeriesWidget, "metric" | "groupBy">,
): string =>
  key === "total" || !widget.groupBy
    ? METRICS[widget.metric].label
    : dimensionValueLabel(widget.groupBy, key);

export interface BuildOptions {
  widget: SeriesWidget;
  /** First day of the current period (alignment anchor). */
  periodFrom: string;
  comparisonMode: Comparison["mode"];
  /** Label of the compared period, e.g. "08/2026". */
  comparisonLabel: string;
}

/**
 * Datasets in drawing order: current series (solid), comparison (dashed, aligned on the
 * current period) and projection (dotted). Stacked bars compare against the summed total.
 */
export const buildDatasets = (
  response: TimeseriesResponse,
  { widget, periodFrom, comparisonMode, comparisonLabel }: BuildOptions,
): SeriesDataset[] => {
  const grouped = response.series.length > 1;
  const current = sortByCategory(widget.groupBy, response.series);
  // Fixed slot per entity; unknown keys take the slots after the known ones.
  const slotOf = (key: string) => {
    const slot = categorySlot(widget.groupBy, key);
    return slot >= 0 ? slot : current.findIndex((s) => s.key === key);
  };
  const datasets: SeriesDataset[] = current.map((s) => ({
    role: "current",
    colorIndex: slotOf(s.key),
    label: seriesLabel(s.key, widget),
    points: toPoints(s),
  }));

  if (response.comparison) {
    const projectionAsComparison = comparisonMode === "projection";
    const offset = alignmentOffset(periodFrom, response.comparison.range.from);
    const compared =
      widget.type === "stacked_bar" && response.comparison.series.length > 1
        ? [sumSeries(response.comparison.series)]
        : response.comparison.series;
    sortByCategory(widget.groupBy, compared).forEach((s) => {
      const name =
        s.key === "total" && widget.type === "stacked_bar" && grouped
          ? "Total"
          : seriesLabel(s.key, widget);
      datasets.push({
        role: projectionAsComparison ? "projection" : "comparison",
        colorIndex: Math.max(slotOf(s.key), 0),
        label: projectionAsComparison
          ? grouped
            ? `${name} (projeção)`
            : "Projeção"
          : grouped
            ? `${name} (${comparisonLabel})`
            : comparisonLabel,
        points: toPoints(s, projectionAsComparison ? 0 : offset),
      });
    });
  }

  response.projection?.series.forEach((s) => {
    datasets.push({
      role: "projection",
      colorIndex: 0,
      label:
        s.key === "total"
          ? "Projeção"
          : `${seriesLabel(s.key, widget)} (projeção)`,
      points: toPoints(s),
    });
  });
  return datasets;
};

/** Relative deviation of the actual value from the projection at each x (|pct| ≥ threshold). */
export const projectionDeviations = (
  actual: readonly SeriesPoint[],
  projection: readonly SeriesPoint[],
  thresholdPct = 10,
): Map<number, number> => {
  const expected = new Map(projection.map((p) => [p.x, p.y]));
  const deviations = new Map<number, number>();
  for (const point of actual) {
    const e = expected.get(point.x);
    if (point.y === null || e === null || e === undefined || e === 0) continue;
    const pct = ((point.y - e) / Math.abs(e)) * 100;
    if (Math.abs(pct) >= thresholdPct) deviations.set(point.x, pct);
  }
  return deviations;
};

export const pointCount = (datasets: readonly SeriesDataset[]): number =>
  Math.max(0, ...datasets.map((d) => d.points.length));

export const hasData = (response: TimeseriesResponse): boolean =>
  response.series.some((s) => s.points.v.some((v) => v !== null));
