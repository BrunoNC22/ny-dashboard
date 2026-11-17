import { z } from "zod";

import { uniqueArray } from "./helpers";
import {
  boroughSchema,
  companySchema,
  dateRangeSchema,
  serviceSchema,
  zoneIdSchema,
} from "./primitives";

/** How a period is compared (CLAUDE.md §6.2). */
export const comparisonSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("previous_period") }),
  z.object({ mode: z.literal("previous_year") }),
  z.object({ mode: z.literal("custom"), range: dateRangeSchema }),
  z.object({ mode: z.literal("projection") }),
]);
export type Comparison = z.infer<typeof comparisonSchema>;
export type ComparisonMode = Comparison["mode"];

/**
 * Dimension filters. An empty array means "no filter" (all values).
 */
const dimensionFilterShape = {
  services: uniqueArray(serviceSchema),
  companies: uniqueArray(companySchema),
  boroughs: uniqueArray(boroughSchema),
};

/** Filters chosen in the dashboard header; persisted with the dashboard state. */
export const globalFiltersSchema = z.object({
  period: dateRangeSchema,
  comparison: comparisonSchema,
  ...dimensionFilterShape,
});
export type GlobalFilters = z.infer<typeof globalFiltersSchema>;

/**
 * Per-widget overrides. Any field left undefined inherits the global value.
 * Widgets may additionally filter by zone.
 */
export const widgetFilterOverridesSchema = z.object({
  period: dateRangeSchema.optional(),
  comparison: comparisonSchema.optional(),
  services: dimensionFilterShape.services.optional(),
  companies: dimensionFilterShape.companies.optional(),
  boroughs: dimensionFilterShape.boroughs.optional(),
  zones: uniqueArray(zoneIdSchema).optional(),
});
export type WidgetFilterOverrides = z.infer<typeof widgetFilterOverridesSchema>;

/** Fully resolved filters sent to the query endpoints. */
export const queryFiltersSchema = z.object({
  period: dateRangeSchema,
  ...dimensionFilterShape,
  zones: uniqueArray(zoneIdSchema),
});
export type QueryFilters = z.infer<typeof queryFiltersSchema>;
