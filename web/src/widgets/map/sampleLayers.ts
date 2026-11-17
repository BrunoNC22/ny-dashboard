import {
  type ColorBy,
  dimensionValueLabel,
  type MapRequest,
  type MapResponse,
} from "@ny-dashboard/shared";

import type { Rgba } from "../../map/mapTheme";
import { categorySlot } from "../categoryOrder";
import type { EffectiveFilters } from "../resolveFilters";
import type { MapWidget } from "./transform";

type PointsResponse = Extract<MapResponse, { mode: "points" }>;
type FlowsResponse = Extract<MapResponse, { mode: "flows" }>;

/** Layers drawn from the individual-trip sample. */
export const SAMPLE_LAYERS = ["heatmap", "points", "hexagon"] as const;
export const usesSample = (widget: MapWidget): boolean =>
  widget.layers.some((l) => (SAMPLE_LAYERS as readonly string[]).includes(l));
export const usesFlows = (widget: MapWidget): boolean =>
  widget.layers.includes("arcs");

/** Top routes drawn as arcs. */
export const FLOW_LIMIT = 150;

export const toPointsRequest = (
  widget: MapWidget,
  filters: EffectiveFilters,
): Extract<MapRequest, { mode: "points" }> => {
  const { comparison: _c, ...queryFilters } = filters;
  return { mode: "points", filters: queryFilters, colorBy: widget.colorBy };
};

export const toFlowsRequest = (
  widget: MapWidget,
  filters: EffectiveFilters,
): Extract<MapRequest, { mode: "flows" }> => {
  const { comparison: _c, ...queryFilters } = filters;
  return {
    mode: "flows",
    metric: widget.metric,
    filters: queryFilters,
    limit: FLOW_LIMIT,
  };
};

// ── Points ─────────────────────────────────────────────────────────────────────

/** Shape per color slot (second channel, CLAUDE.md §7): same order as POINT_STYLES. */
export const SHAPES = ["circle", "square", "triangle", "diamond"] as const;
export type Shape = (typeof SHAPES)[number];
export const shapeOf = (slot: number): Shape =>
  SHAPES[slot % SHAPES.length] ?? "circle";

export interface PointCategory {
  key: string;
  label: string;
  slot: number;
  shape: Shape;
  count: number;
}

/**
 * Up to ~1M points as typed arrays (positions, per-point category index): deck.gl reads them by
 * index, so no million objects are created.
 */
export interface PointColumns {
  length: number;
  positions: Float32Array;
  /** Index into `categories` for each point. */
  category: Uint8Array;
  categories: PointCategory[];
}

export const toPointColumns = (
  response: PointsResponse,
  colorBy: ColorBy,
): PointColumns => {
  const { lon, lat, category } = response.columns;
  const length = lon.length;
  const positions = new Float32Array(length * 2);
  const categoryIndex = new Uint8Array(length);
  const counts = new Array<number>(response.categories.length).fill(0);
  for (let i = 0; i < length; i++) {
    positions[i * 2] = lon[i] ?? 0;
    positions[i * 2 + 1] = lat[i] ?? 0;
    const c = category[i] ?? 0;
    categoryIndex[i] = c;
    counts[c] = (counts[c] ?? 0) + 1;
  }
  const categories = response.categories.map((key, i) => {
    const fixed = categorySlot(colorBy, key);
    const slot = fixed >= 0 ? fixed : i;
    return {
      key,
      label: dimensionValueLabel(colorBy, key),
      slot,
      shape: shapeOf(slot),
      count: counts[i] ?? 0,
    };
  });
  return { length, positions, category: categoryIndex, categories };
};

export const positionAt = (
  columns: PointColumns,
  index: number,
): [number, number] => [
  columns.positions[index * 2] ?? 0,
  columns.positions[index * 2 + 1] ?? 0,
];

/** Palette color of each category, indexed like `categories`. */
export const categoryRgba = (
  columns: PointColumns,
  colors: readonly Rgba[],
  fallback: Rgba,
): Rgba[] => columns.categories.map((c) => colors[c.slot] ?? fallback);

// ── Flows ──────────────────────────────────────────────────────────────────────

export interface Flow {
  from: [number, number];
  to: [number, number];
  fromName: string;
  toName: string;
  value: number;
}

export interface ZoneInfo {
  centroid: [number, number];
  name: string;
}

/** Routes with both ends known (zones 264/265 have no geometry and are already excluded). */
export const toFlows = (
  response: FlowsResponse,
  zones: ReadonlyMap<number, ZoneInfo>,
): Flow[] => {
  const { from, to, value } = response.columns;
  const flows: Flow[] = [];
  from.forEach((a, i) => {
    const b = to[i];
    const origin = zones.get(a);
    const destination = b === undefined ? undefined : zones.get(b);
    if (!origin || !destination || a === b) return;
    flows.push({
      from: origin.centroid,
      to: destination.centroid,
      fromName: origin.name,
      toName: destination.name,
      value: value[i] ?? 0,
    });
  });
  return flows;
};

/** Arc width in px: square-root scale, 1 to `max`. */
export const arcWidth = (value: number, maxValue: number, max = 8) =>
  maxValue <= 0 ? 1 : Math.max(1, Math.sqrt(value / maxValue) * max);
