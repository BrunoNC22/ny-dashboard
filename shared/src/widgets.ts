import { z } from "zod";

import { widgetFilterOverridesSchema } from "./filters";
import { uniqueArray } from "./helpers";
import {
  categoricalDimensionSchema,
  colorBySchema,
  granularitySchema,
  metricDirectionSchema,
  metricIdSchema,
  seriesDimensionSchema,
  sortDirectionSchema,
  tripFieldSchema,
} from "./primitives";

export const WIDGET_TYPES = [
  // time series
  "line",
  "area",
  "bar",
  "stacked_bar",
  // categorical
  "doughnut",
  "pie",
  "radar",
  "polar_area",
  "bar_horizontal",
  // trip sample
  "scatter",
  "bubble",
  // others
  "kpi",
  "table",
  "map",
] as const;
export const widgetTypeSchema = z.enum(WIDGET_TYPES);
export type WidgetType = z.infer<typeof widgetTypeSchema>;

export const widgetIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Only letters, digits, `_` and `-`");
export type WidgetId = z.infer<typeof widgetIdSchema>;

const base = {
  id: widgetIdSchema,
  title: z.string().trim().min(1).max(80),
  filters: widgetFilterOverridesSchema.optional(),
};

// ── Time series ────────────────────────────────────────────────────────────────

const timeseriesShape = {
  ...base,
  metric: metricIdSchema,
  granularity: granularitySchema,
  groupBy: seriesDimensionSchema.optional(),
  /** Overlay the Holt-Winters projection (only for granularity >= day). */
  showProjection: z.boolean(),
};

export const lineWidgetSchema = z.object({
  ...timeseriesShape,
  type: z.literal("line"),
});
export const areaWidgetSchema = z.object({
  ...timeseriesShape,
  type: z.literal("area"),
});
export const barWidgetSchema = z.object({
  ...timeseriesShape,
  type: z.literal("bar"),
});
/** Stacked bars need a dimension to stack by. */
export const stackedBarWidgetSchema = z.object({
  ...timeseriesShape,
  type: z.literal("stacked_bar"),
  groupBy: seriesDimensionSchema,
});

// ── Categorical ────────────────────────────────────────────────────────────────

const categoricalShape = {
  ...base,
  metric: metricIdSchema,
  dimension: categoricalDimensionSchema,
  /** Keep the top N categories and group the rest as "Outros". */
  topN: z.number().int().min(2).max(50).optional(),
};

export const doughnutWidgetSchema = z.object({
  ...categoricalShape,
  type: z.literal("doughnut"),
});
export const pieWidgetSchema = z.object({
  ...categoricalShape,
  type: z.literal("pie"),
});
export const radarWidgetSchema = z.object({
  ...categoricalShape,
  type: z.literal("radar"),
});
export const polarAreaWidgetSchema = z.object({
  ...categoricalShape,
  type: z.literal("polar_area"),
});
export const barHorizontalWidgetSchema = z.object({
  ...categoricalShape,
  type: z.literal("bar_horizontal"),
});

// ── Trip sample ────────────────────────────────────────────────────────────────

export const scatterWidgetSchema = z.object({
  ...base,
  type: z.literal("scatter"),
  x: tripFieldSchema,
  y: tripFieldSchema,
  colorBy: colorBySchema,
});

export const bubbleWidgetSchema = z.object({
  ...base,
  type: z.literal("bubble"),
  x: tripFieldSchema,
  y: tripFieldSchema,
  r: tripFieldSchema,
  colorBy: colorBySchema,
});

// ── KPI ────────────────────────────────────────────────────────────────────────

/**
 * Good/warning/bad evaluation (CLAUDE.md §6.3). Both strategies can be combined.
 * - comparison: change vs the compared period; |change| below `neutralBandPct` is "warning".
 * - target: reaching the target is "good"; missing it by up to `warningBandPct` is "warning".
 */
export const kpiEvaluationSchema = z.object({
  /** Overrides the metric's default direction from the catalog. */
  direction: metricDirectionSchema.optional(),
  comparison: z.object({
    enabled: z.boolean(),
    neutralBandPct: z.number().min(0).max(100),
  }),
  target: z
    .object({
      value: z.number(),
      warningBandPct: z.number().min(0).max(100),
    })
    .nullable(),
});
export type KpiEvaluation = z.infer<typeof kpiEvaluationSchema>;

export const kpiWidgetSchema = z.object({
  ...base,
  type: z.literal("kpi"),
  metric: metricIdSchema,
  sparkline: z.boolean(),
  evaluation: kpiEvaluationSchema,
});

// ── Table ──────────────────────────────────────────────────────────────────────

export const TABLE_DIMENSIONS = [
  "zone",
  "route",
  "borough",
  "service",
  "company",
] as const;
export const tableDimensionSchema = z.enum(TABLE_DIMENSIONS);

export const tableWidgetSchema = z
  .object({
    ...base,
    type: z.literal("table"),
    dimension: tableDimensionSchema,
    columns: uniqueArray(metricIdSchema).min(1).max(6),
    sortBy: metricIdSchema,
    sortDir: sortDirectionSchema,
    limit: z.number().int().min(5).max(100),
  })
  .refine((table) => table.columns.includes(table.sortBy), {
    message: "`sortBy` must be one of the table columns",
    path: ["sortBy"],
  });

// ── Map ────────────────────────────────────────────────────────────────────────

export const MAP_LAYERS = [
  "choropleth",
  "bubbles",
  "heatmap",
  "arcs",
  "points",
  "hexagon",
] as const;
export const mapLayerSchema = z.enum(MAP_LAYERS);
export type MapLayer = z.infer<typeof mapLayerSchema>;

export const mapWidgetSchema = z.object({
  ...base,
  type: z.literal("map"),
  /** Metric used by zone-based layers (choropleth, bubbles, arcs). */
  metric: metricIdSchema,
  layers: uniqueArray(mapLayerSchema).min(1),
  colorBy: colorBySchema,
});

// ── Union ──────────────────────────────────────────────────────────────────────

export const widgetConfigSchema = z.discriminatedUnion("type", [
  lineWidgetSchema,
  areaWidgetSchema,
  barWidgetSchema,
  stackedBarWidgetSchema,
  doughnutWidgetSchema,
  pieWidgetSchema,
  radarWidgetSchema,
  polarAreaWidgetSchema,
  barHorizontalWidgetSchema,
  scatterWidgetSchema,
  bubbleWidgetSchema,
  kpiWidgetSchema,
  tableWidgetSchema,
  mapWidgetSchema,
]);
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type WidgetConfigOf<T extends WidgetType> = Extract<
  WidgetConfig,
  { type: T }
>;
