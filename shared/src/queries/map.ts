import { z } from "zod";

import { comparisonSchema, queryFiltersSchema } from "../filters";
import { sameLengthColumns } from "../helpers";
import {
  colorBySchema,
  dateRangeSchema,
  metricIdSchema,
  zoneIdSchema,
} from "../primitives";
import { nullableNumber } from "./common";

// ── Requests ───────────────────────────────────────────────────────────────────

export const mapRequestSchema = z.discriminatedUnion("mode", [
  /** Value per pickup zone (choropleth, bubbles); with comparison → delta per zone. */
  z.object({
    mode: z.literal("zones"),
    metric: metricIdSchema,
    filters: queryFiltersSchema,
    comparison: comparisonSchema,
  }),
  /** Top origin → destination routes (arcs). */
  z.object({
    mode: z.literal("flows"),
    metric: metricIdSchema,
    filters: queryFiltersSchema,
    limit: z.number().int().min(1).max(1000),
  }),
  /** Individual trips from the sample with approximate positions (points, heatmap, hexagon). */
  z.object({
    mode: z.literal("points"),
    filters: queryFiltersSchema,
    colorBy: colorBySchema,
  }),
]);
export type MapRequest = z.infer<typeof mapRequestSchema>;

// ── Responses (columnar) ───────────────────────────────────────────────────────

export const mapZonesResponseSchema = z.object({
  mode: z.literal("zones"),
  metric: metricIdSchema,
  notApplicable: z.boolean(),
  comparisonRange: dateRangeSchema.nullable(),
  columns: z
    .object({
      zoneId: z.array(zoneIdSchema),
      value: z.array(nullableNumber),
      comparisonValue: z.array(nullableNumber).nullable(),
      deltaPct: z.array(nullableNumber).nullable(),
    })
    .superRefine(sameLengthColumns),
});

export const mapFlowsResponseSchema = z.object({
  mode: z.literal("flows"),
  metric: metricIdSchema,
  notApplicable: z.boolean(),
  columns: z
    .object({
      from: z.array(zoneIdSchema),
      to: z.array(zoneIdSchema),
      value: z.array(z.number()),
    })
    .superRefine(sameLengthColumns),
});

export const mapPointsResponseSchema = z.object({
  mode: z.literal("points"),
  /** Values referenced by `columns.category` (index into this list). */
  categories: z.array(z.string()),
  columns: z
    .object({
      lon: z.array(z.number()),
      lat: z.array(z.number()),
      category: z.array(z.number().int().min(0)),
    })
    .superRefine(sameLengthColumns),
});

export const mapResponseSchema = z.discriminatedUnion("mode", [
  mapZonesResponseSchema,
  mapFlowsResponseSchema,
  mapPointsResponseSchema,
]);
export type MapResponse = z.infer<typeof mapResponseSchema>;
