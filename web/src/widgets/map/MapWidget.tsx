import "../../map/mapTooltip.css";

import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import type { Layer, PickingInfo } from "@deck.gl/core";
import {
  ArcLayer,
  GeoJsonLayer,
  IconLayer,
  ScatterplotLayer,
} from "@deck.gl/layers";
import {
  DATA_COVERAGE,
  formatMetric,
  formatValue,
  METRICS,
} from "@ny-dashboard/shared";
import { useMemo } from "react";

import { type ZoneFeature } from "../../api/client";
import { useMapQuery, useMeta, useZones } from "../../api/hooks";
import { cn } from "../../components/ui";
import { BaseMap } from "../../map/BaseMap";
import { DeckOverlay } from "../../map/DeckOverlay";
import {
  arcColors,
  categoryColors,
  divergingColor,
  hexToRgba,
  quantileColorScale,
  type Rgba,
  sequentialRamp,
  zoneLineColor,
} from "../../map/mapTheme";
import { createShapeAtlas } from "../../map/shapeAtlas";
import { useMapTheme } from "../../map/useMapTheme";
import { sampleNotice } from "../sample/transform";
import type { WidgetProps } from "../types";
import { WidgetBody } from "../WidgetBody";
import { WidgetNotices } from "../WidgetNotices";
import {
  ArcsLegend,
  DensityLegend,
  MapLegend,
  PointsLegend,
} from "./MapLegend";
import {
  arcWidth,
  type Flow,
  positionAt,
  SHAPES,
  toFlows,
  toFlowsRequest,
  toPointColumns,
  toPointsRequest,
  usesFlows,
  usesSample,
  type ZoneInfo,
} from "./sampleLayers";
import { flowTooltip, zoneTooltip } from "./tooltip";
import {
  bubbleRadius,
  isComparing,
  maxValue,
  toZonesRequest,
  usesZoneValues,
  type ZoneValue,
  zoneValues,
} from "./transform";

const NO_COLOR: Rgba = [0, 0, 0, 0];

/**
 * Map widget (#48, #49), loaded on demand. Zone layers: choropleth (quantiles, or the change on
 * the red ↔ green improvement scale) and bubbles. Trip sample (GPU, up to ~1M points, approximate
 * positions): heatmap, points with a shape per category and 3D hexagons. Flows: top routes as
 * glowing arcs.
 */
export default function MapWidget({ widget, filters }: WidgetProps<"map">) {
  const { theme, palette } = useMapTheme();
  const zones = useZones();
  const sampleMonth = useMeta().data?.sampleMonth ?? DATA_COVERAGE.sampleMonth;
  const metric = METRICS[widget.metric];

  const zoneMode = usesZoneValues(widget);
  const sampleMode = usesSample(widget);
  const flowMode = usesFlows(widget);
  const zonesRequest = useMemo(
    () => toZonesRequest(widget, filters),
    [widget, filters],
  );
  const pointsRequest = useMemo(
    () => toPointsRequest(widget, filters),
    [widget, filters],
  );
  const flowsRequest = useMemo(
    () => toFlowsRequest(widget, filters),
    [widget, filters],
  );
  const zonesQuery = useMapQuery(zonesRequest, { enabled: zoneMode });
  const pointsQuery = useMapQuery(pointsRequest, { enabled: sampleMode });
  const flowsQuery = useMapQuery(flowsRequest, { enabled: flowMode });
  const zonesData =
    zonesQuery.data?.mode === "zones" ? zonesQuery.data : undefined;
  const pointsData =
    pointsQuery.data?.mode === "points" ? pointsQuery.data : undefined;
  const flowsData =
    flowsQuery.data?.mode === "flows" ? flowsQuery.data : undefined;

  const values = useMemo(
    () => (zonesData ? zoneValues(zonesData) : new Map<number, ZoneValue>()),
    [zonesData],
  );
  const comparing = zonesData ? isComparing(zonesData) : false;
  const scale = useMemo(
    () =>
      quantileColorScale(
        [...values.values()].map((v) => v.value),
        theme,
      ),
    [values, theme],
  );
  const points = useMemo(
    () => (pointsData ? toPointColumns(pointsData, widget.colorBy) : null),
    [pointsData, widget.colorBy],
  );
  const zoneInfo = useMemo(
    () =>
      new Map<number, ZoneInfo>(
        (zones.data?.features ?? []).map((f) => [
          f.id,
          { centroid: f.properties.centroid, name: f.properties.zone },
        ]),
      ),
    [zones.data],
  );
  const flows = useMemo(
    () => (flowsData ? toFlows(flowsData, zoneInfo) : []),
    [flowsData, zoneInfo],
  );
  const atlas = useMemo(() => createShapeAtlas(SHAPES), []);

  const layers = useMemo(() => {
    const features = zones.data?.features ?? [];
    const out: Layer[] = [];
    const ramp = sequentialRamp(theme).map((hex) => hexToRgba(hex, 230));
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
          updateTriggers: {
            getFillColor: [values, comparing, theme, palette],
          },
        }),
      );
    }

    if (points && widget.layers.includes("heatmap")) {
      out.push(
        new HeatmapLayer<unknown>({
          id: "heatmap",
          data: { length: points.length },
          getPosition: (_, { index }) => positionAt(points, index),
          radiusPixels: 28,
          intensity: 1,
          threshold: 0.04,
          colorRange: ramp.slice(theme === "dark" ? 1 : 0),
          updateTriggers: { getPosition: [points] },
        }),
      );
    }

    if (points && widget.layers.includes("hexagon")) {
      out.push(
        new HexagonLayer<unknown>({
          id: "hexagon",
          data: { length: points.length },
          getPosition: (_, { index }) => positionAt(points, index),
          gpuAggregation: true,
          radius: 300,
          coverage: 0.85,
          extruded: true,
          elevationScale: 12,
          colorRange: ramp,
          pickable: true,
          updateTriggers: { getPosition: [points] },
        }),
      );
    }

    if (flows.length > 0 && widget.layers.includes("arcs")) {
      const max = flows.reduce((m, f) => Math.max(m, f.value), 0);
      const colors = arcColors(palette, theme);
      const glow = (c: Rgba): Rgba => [c[0], c[1], c[2], 40];
      // Glow: a wide translucent arc under each sharp one.
      out.push(
        new ArcLayer<Flow>({
          id: "arcs-glow",
          data: flows,
          getSourcePosition: (f) => f.from,
          getTargetPosition: (f) => f.to,
          getSourceColor: glow(colors.source),
          getTargetColor: glow(colors.target),
          getWidth: (f) => arcWidth(f.value, max) * 2.2,
          getHeight: 0.5,
          updateTriggers: {
            getSourceColor: [theme, palette],
            getTargetColor: [theme, palette],
          },
        }),
        new ArcLayer<Flow>({
          id: "arcs",
          data: flows,
          pickable: true,
          autoHighlight: true,
          getSourcePosition: (f) => f.from,
          getTargetPosition: (f) => f.to,
          getSourceColor: colors.source,
          getTargetColor: colors.target,
          getWidth: (f) => arcWidth(f.value, max),
          getHeight: 0.5,
          updateTriggers: {
            getSourceColor: [theme, palette],
            getTargetColor: [theme, palette],
          },
        }),
      );
    }

    if (points && atlas && widget.layers.includes("points")) {
      const colors = categoryColors(palette, theme, 210);
      const byCategory = points.categories.map((c) => ({
        color: colors[c.slot] ?? NO_COLOR,
        shape: c.shape,
      }));
      const size =
        points.length > 200_000 ? 5 : points.length > 20_000 ? 7 : 10;
      out.push(
        new IconLayer<unknown>({
          id: "points",
          data: { length: points.length },
          iconAtlas: atlas.atlas,
          iconMapping: atlas.mapping,
          getIcon: (_, { index }) =>
            byCategory[points.category[index] ?? 0]?.shape ?? "circle",
          getPosition: (_, { index }) => positionAt(points, index),
          getColor: (_, { index }) =>
            byCategory[points.category[index] ?? 0]?.color ?? NO_COLOR,
          getSize: size,
          sizeUnits: "pixels",
          updateTriggers: {
            getColor: [points, theme, palette],
            getIcon: [points],
            getPosition: [points],
          },
        }),
      );
    }

    if (widget.layers.includes("bubbles")) {
      const max = maxValue(values.values());
      const [bubbleColor = NO_COLOR] = categoryColors(palette, theme, 170);
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
    points,
    flows,
    atlas,
    widget.layers,
    metric.direction,
    theme,
    palette,
  ]);

  const queries = [
    [zoneMode, zonesQuery],
    [sampleMode, pointsQuery],
    [flowMode, flowsQuery],
  ] as const;
  if (zones.isPending || queries.some(([on, q]) => on && q.isPending)) {
    return <WidgetBody status="loading" />;
  }
  if (zones.isError || queries.some(([on, q]) => on && q.isError)) {
    return (
      <WidgetBody
        status="error"
        onRetry={() => {
          void zones.refetch();
          for (const [on, q] of queries) if (on) void q.refetch();
        }}
      />
    );
  }
  if (zonesData?.notApplicable && !sampleMode && !flowMode) {
    return <WidgetBody status="not_applicable" />;
  }

  const notices: string[] = [];
  if (zoneMode && filters.comparison.mode === "projection") {
    notices.push(
      "A projeção não existe por zona: o mapa mostra só os valores.",
    );
  }
  if (sampleMode) {
    const outside = sampleNotice(filters, sampleMonth);
    if (outside) notices.push(outside);
    notices.push(
      "Amostra de corridas: posição aproximada dentro da zona de embarque.",
    );
  }
  if (flowMode && flowsData?.notApplicable) {
    notices.push("Rotas só têm corridas, receita, distância e duração.");
  }

  const getTooltip = ({ object, layer }: PickingInfo) => {
    if (!object || !layer) return null;
    if (layer.id === "arcs") return flowTooltip(object as Flow, widget.metric);
    if (layer.id === "hexagon") {
      const count = (object as { count?: number }).count ?? 0;
      return {
        className: "nyd-map-tooltip",
        html: `<div class="nyd-tip-value">${formatValue(count, "count")} corridas da amostra</div>`,
      };
    }
    return zoneTooltip(object as ZoneFeature, values, {
      metric: widget.metric,
      comparing,
      direction: metric.direction,
    });
  };

  const placeholder = [zonesQuery, pointsQuery, flowsQuery].some(
    (q) => q.isPlaceholderData,
  );
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-1.5 transition-opacity",
        placeholder && "opacity-60",
      )}
    >
      <div className="relative min-h-0 flex-1" data-no-drag>
        <BaseMap
          cooperativeGestures
          pitch={
            widget.layers.includes("hexagon")
              ? 45
              : widget.layers.includes("arcs")
                ? 40
                : 0
          }
        >
          <DeckOverlay layers={layers} getTooltip={getTooltip} />
        </BaseMap>
        <div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col items-start gap-1.5">
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
          {points && widget.layers.includes("points") && (
            <PointsLegend
              categories={points.categories}
              colors={categoryColors(palette, theme, 255)}
            />
          )}
          {flows.length > 0 && widget.layers.includes("arcs") && (
            <ArcsLegend palette={palette} theme={theme} count={flows.length} />
          )}
          {points &&
            (widget.layers.includes("heatmap") ||
              widget.layers.includes("hexagon")) && (
              <DensityLegend theme={theme} total={points.length} />
            )}
        </div>
      </div>
      <WidgetNotices notices={notices} />
    </div>
  );
}
