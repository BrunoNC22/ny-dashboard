import "../../map/mapTooltip.css";

import type { Layer, PickingInfo } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { formatMetric, METRICS } from "@ny-dashboard/shared";
import { useMemo } from "react";

import { type ZoneFeature } from "../../api/client";
import { useMapQuery, useZones } from "../../api/hooks";
import { cn } from "../../components/ui";
import { BaseMap } from "../../map/BaseMap";
import { DeckOverlay } from "../../map/DeckOverlay";
import {
  categoryColors,
  divergingColor,
  quantileColorScale,
  zoneLineColor,
} from "../../map/mapTheme";
import { useMapTheme } from "../../map/useMapTheme";
import type { WidgetProps } from "../types";
import { WidgetBody } from "../WidgetBody";
import { WidgetNotices } from "../WidgetNotices";
import { MapLegend } from "./MapLegend";
import { zoneTooltip } from "./tooltip";
import {
  bubbleRadius,
  isComparing,
  maxValue,
  toZonesRequest,
  usesZoneValues,
  type ZoneValue,
  zoneValues,
} from "./transform";

/**
 * Map widget (#48): zones colored by the metric (quantiles) or, with a comparison, by the change
 * on the red ↔ green scale by improvement; bubbles per zone; tooltip and legend. Loaded on
 * demand (MapLibre + deck.gl stay out of the main bundle).
 */
export default function MapWidget({ widget, filters }: WidgetProps<"map">) {
  const { theme, palette } = useMapTheme();
  const zones = useZones();
  const zoneMode = usesZoneValues(widget);
  const request = useMemo(
    () => toZonesRequest(widget, filters),
    [widget, filters],
  );
  const query = useMapQuery(request, { enabled: zoneMode });
  const response = query.data?.mode === "zones" ? query.data : undefined;
  const metric = METRICS[widget.metric];

  const values = useMemo(
    () => (response ? zoneValues(response) : new Map<number, ZoneValue>()),
    [response],
  );
  const comparing = response ? isComparing(response) : false;
  const scale = useMemo(
    () =>
      quantileColorScale(
        [...values.values()].map((v) => v.value),
        theme,
      ),
    [values, theme],
  );

  const layers = useMemo(() => {
    const features = zones.data?.features ?? [];
    const out: Layer[] = [];
    const fillOf = (id: number) => {
      const v = values.get(id);
      return comparing
        ? divergingColor(v?.deltaPct ?? null, metric.direction, theme)
        : scale.colorOf(v?.value ?? null);
    };
    if (widget.layers.includes("choropleth")) {
      out.push(
        new GeoJsonLayer<ZoneFeature["properties"]>({
          id: "zones",
          data: features as never,
          filled: true,
          stroked: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          getFillColor: (f) => fillOf(f.properties.locationId),
          getLineColor: zoneLineColor(theme),
          lineWidthMinPixels: 0.5,
          updateTriggers: { getFillColor: [values, comparing, theme, palette] },
        }),
      );
    }
    if (widget.layers.includes("bubbles")) {
      const max = maxValue(values.values());
      const [bubbleColor = [0, 0, 0, 0]] = categoryColors(palette, theme, 170);
      out.push(
        new ScatterplotLayer<ZoneFeature>({
          id: "bubbles",
          data: features,
          pickable: true,
          stroked: true,
          radiusUnits: "pixels",
          getPosition: (f) => f.properties.centroid,
          getRadius: (f) => bubbleRadius(values.get(f.id)?.value ?? null, max),
          getFillColor: (f) => (comparing ? fillOf(f.id) : bubbleColor),
          getLineColor:
            theme === "dark" ? [255, 255, 255, 90] : [255, 255, 255, 200],
          lineWidthMinPixels: 1,
          updateTriggers: {
            getRadius: [values],
            getFillColor: [values, comparing, theme, palette],
          },
        }),
      );
    }
    return out;
  }, [
    zones.data,
    values,
    comparing,
    scale,
    widget.layers,
    metric.direction,
    theme,
    palette,
  ]);

  if (zones.isPending || (zoneMode && query.isPending)) {
    return <WidgetBody status="loading" />;
  }
  if (zones.isError || (zoneMode && query.isError)) {
    return (
      <WidgetBody
        status="error"
        onRetry={() => {
          void zones.refetch();
          void query.refetch();
        }}
      />
    );
  }
  if (response?.notApplicable) return <WidgetBody status="not_applicable" />;

  const notices: string[] = [];
  if (zoneMode && filters.comparison.mode === "projection") {
    notices.push(
      "A projeção não existe por zona: o mapa mostra só os valores.",
    );
  }
  const pending = widget.layers.filter(
    (l) => l !== "choropleth" && l !== "bubbles",
  );
  if (pending.length > 0) {
    notices.push(
      "Calor, rotas, pontos e hexágonos chegam na próxima etapa (#49).",
    );
  }

  const getTooltip = ({ object }: PickingInfo) =>
    object
      ? zoneTooltip(object as ZoneFeature, values, {
          metric: widget.metric,
          comparing,
          direction: metric.direction,
        })
      : null;

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-1.5 transition-opacity",
        query.isPlaceholderData && "opacity-60",
      )}
    >
      <div className="relative min-h-0 flex-1" data-no-drag>
        <BaseMap cooperativeGestures>
          <DeckOverlay layers={layers} getTooltip={getTooltip} />
        </BaseMap>
        {zoneMode && (
          <MapLegend
            mode={
              comparing
                ? "diverging"
                : widget.layers.includes("choropleth")
                  ? "sequential"
                  : "size"
            }
            metricLabel={metric.label}
            theme={theme}
            colors={scale.colors}
            min={formatMetric(widget.metric, scale.breaks[0] ?? null, {
              compact: true,
            })}
            max={formatMetric(
              widget.metric,
              widget.layers.includes("choropleth") || comparing
                ? (scale.breaks.at(-1) ?? null)
                : maxValue(values.values()),
              { compact: true },
            )}
          />
        )}
      </div>
      <WidgetNotices notices={notices} />
    </div>
  );
}
