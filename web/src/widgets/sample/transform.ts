import {
  type ColorBy,
  dimensionValueLabel,
  formatIsoDate,
  type TripsRequest,
  type TripsResponse,
  type WidgetConfigOf,
} from "@ny-dashboard/shared";

import { pointStyle } from "../../charts/chartTheme";
import { categorySlot } from "../categoryOrder";
import type { EffectiveFilters } from "../resolveFilters";

export type SampleWidget = WidgetConfigOf<"scatter" | "bubble">;

/** Above this many points the hover/tooltip is turned off (nearest-point search on every move). */
export const HOVER_LIMIT = 100_000;
/** Above this many points the widget warns that rendering will be slow (CLAUDE.md §8). */
export const HEAVY_LIMIT = 100_000;

export const toTripsRequest = (
  widget: SampleWidget,
  filters: EffectiveFilters,
): TripsRequest => {
  const { comparison: _c, ...queryFilters } = filters;
  return {
    x: widget.x,
    y: widget.y,
    ...(widget.type === "bubble" ? { r: widget.r } : {}),
    colorBy: widget.colorBy,
    filters: queryFilters,
  };
};

/** The sample has a single month: say so when the period does not include it. */
export const sampleNotice = (
  filters: EffectiveFilters,
  sampleMonth: string,
): string | null => {
  const from = `${sampleMonth}-01`;
  const overlaps =
    filters.period.from.slice(0, 7) <= sampleMonth && filters.period.to >= from;
  return overlaps
    ? null
    : `A amostra de corridas cobre só ${formatIsoDate(sampleMonth)}: ajuste o período do widget.`;
};

export interface SamplePoint {
  x: number;
  y: number;
  r?: number;
}

export interface SampleDataset {
  key: string;
  label: string;
  slot: number;
  pointStyle: string;
  points: SamplePoint[];
}

/** Bubble radius in px: square-root scale (area ∝ value) between 1 and `max`. */
export const bubbleRadius = (value: number, maxValue: number, max = 12) =>
  maxValue <= 0
    ? 1
    : Math.max(1, Math.sqrt(Math.max(0, value) / maxValue) * max);

/**
 * Columns → one dataset per category, in the fixed entity order: each gets its color slot
 * and a point shape as a second channel (4 categories, CLAUDE.md §7). Points are sorted by x.
 */
export const toSampleDatasets = (
  response: TripsResponse,
  colorBy: ColorBy,
): SampleDataset[] => {
  const { x, y, r, category } = response.columns;
  const maxR = r ? r.reduce((max, v) => (v > max ? v : max), 0) : 0;
  const buckets = response.categories.map(() => [] as SamplePoint[]);
  for (let i = 0; i < x.length; i++) {
    const bucket = buckets[category[i] ?? -1];
    if (!bucket) continue;
    const point: SamplePoint = { x: x[i] ?? 0, y: y[i] ?? 0 };
    if (r) point.r = bubbleRadius(r[i] ?? 0, maxR);
    bucket.push(point);
  }
  // Chart.js treats `parsing: false` data as sorted by x (axis range from the first/last points,
  // binary search for what to draw): unsorted samples lose points and get wrong axes.
  for (const bucket of buckets) bucket.sort((a, b) => a.x - b.x);
  return response.categories
    .map((key, i) => {
      const fixed = categorySlot(colorBy, key);
      const slot = fixed >= 0 ? fixed : i;
      return {
        key,
        label: dimensionValueLabel(colorBy, key),
        slot,
        pointStyle: pointStyle(slot) ?? "circle",
        points: buckets[i] ?? [],
      };
    })
    .filter((d) => d.points.length > 0)
    .sort((a, b) => a.slot - b.slot);
};

export const totalPoints = (datasets: readonly SampleDataset[]): number =>
  datasets.reduce((sum, d) => sum + d.points.length, 0);
