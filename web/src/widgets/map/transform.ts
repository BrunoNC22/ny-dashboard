import type {
  MapRequest,
  MapResponse,
  WidgetConfigOf,
} from "@ny-dashboard/shared";

import type { EffectiveFilters } from "../resolveFilters";

export type MapWidget = WidgetConfigOf<"map">;
type ZonesResponse = Extract<MapResponse, { mode: "zones" }>;

/** Layers that read values per zone (the rest use the trip sample or the flows). */
export const ZONE_LAYERS = ["choropleth", "bubbles"] as const;

export const usesZoneValues = (widget: MapWidget): boolean =>
  widget.layers.some((l) => (ZONE_LAYERS as readonly string[]).includes(l));

export const toZonesRequest = (
  widget: MapWidget,
  filters: EffectiveFilters,
): Extract<MapRequest, { mode: "zones" }> => {
  const { comparison, ...queryFilters } = filters;
  return {
    mode: "zones",
    metric: widget.metric,
    filters: queryFilters,
    comparison,
  };
};

export interface ZoneValue {
  value: number | null;
  comparisonValue: number | null;
  deltaPct: number | null;
}

/** Columnar response → zone id → value (and change, when compared). */
export const zoneValues = (response: ZonesResponse): Map<number, ZoneValue> => {
  const { zoneId, value, comparisonValue, deltaPct } = response.columns;
  const map = new Map<number, ZoneValue>();
  zoneId.forEach((id, i) => {
    map.set(id, {
      value: value[i] ?? null,
      comparisonValue: comparisonValue?.[i] ?? null,
      deltaPct: deltaPct?.[i] ?? null,
    });
  });
  return map;
};

/** The map compares only when the API sent a compared period (never for the projection). */
export const isComparing = (response: ZonesResponse): boolean =>
  response.comparisonRange !== null && response.columns.deltaPct !== null;

/** Bubble radius in px: square-root scale (area ∝ value), from 2 to `max`. */
export const bubbleRadius = (
  value: number | null,
  maxValue: number,
  max = 28,
) =>
  value === null || value <= 0 || maxValue <= 0
    ? 0
    : Math.max(2, Math.sqrt(value / maxValue) * max);

export const maxValue = (values: Iterable<ZoneValue>): number => {
  let max = 0;
  for (const v of values) if (v.value !== null && v.value > max) max = v.value;
  return max;
};
