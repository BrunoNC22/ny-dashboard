import { z } from "zod";

// ── Data dimensions ────────────────────────────────────────────────────────────

export const SERVICES = ["yellow", "green", "fhvhv"] as const;
export const serviceSchema = z.enum(SERVICES);
export type Service = z.infer<typeof serviceSchema>;

/** For yellow/green the company is the service itself (CLAUDE.md §5.2). */
export const COMPANIES = ["yellow", "green", "uber", "lyft", "other"] as const;
export const companySchema = z.enum(COMPANIES);
export type Company = z.infer<typeof companySchema>;

export const BOROUGHS = [
  "manhattan",
  "brooklyn",
  "queens",
  "bronx",
  "staten_island",
  "ewr",
  "unknown",
] as const;
export const boroughSchema = z.enum(BOROUGHS);
export type Borough = z.infer<typeof boroughSchema>;

/** TLC taxi zone `LocationID` (1–265; 264/265 are "Unknown"/"Outside of NYC"). */
export const zoneIdSchema = z.number().int().min(1).max(265);
export type ZoneId = z.infer<typeof zoneIdSchema>;

// ── Dates ──────────────────────────────────────────────────────────────────────

/** Calendar date `YYYY-MM-DD`, always in America/New_York (CLAUDE.md §2). */
export const isoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof isoDateSchema>;

/** Inclusive date range. */
export const dateRangeSchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((range) => range.from <= range.to, {
    message: "`from` must be on or before `to`",
    path: ["to"],
  });
export type DateRange = z.infer<typeof dateRangeSchema>;

export const GRANULARITIES = ["hour", "day", "week", "month"] as const;
export const granularitySchema = z.enum(GRANULARITIES);
export type Granularity = z.infer<typeof granularitySchema>;

// ── Metrics and dimensions (labels/formulas live in the metric catalog, #15) ──

export const METRIC_IDS = [
  // volume
  "trips",
  "passengers",
  // financial
  "revenue",
  "avg_fare",
  "avg_tip",
  "tip_pct",
  "revenue_per_mile",
  "cbd_fee",
  // operations
  "avg_distance",
  "avg_duration",
  "avg_speed",
  "airport_pct",
  "card_pct",
  "cash_pct",
  // FHVHV only
  "avg_wait",
  "driver_pay_pct",
  "shared_pct",
] as const;
export const metricIdSchema = z.enum(METRIC_IDS);
export type MetricId = z.infer<typeof metricIdSchema>;

export const DIMENSIONS = [
  "service",
  "company",
  "borough",
  "zone",
  "hour_of_day",
  "day_of_week",
  "route",
] as const;
export const dimensionSchema = z.enum(DIMENSIONS);
export type Dimension = z.infer<typeof dimensionSchema>;

/** Low-cardinality dimensions that can split a time series into several lines/stacks. */
export const SERIES_DIMENSIONS = ["service", "company", "borough"] as const;
export const seriesDimensionSchema = z.enum(SERIES_DIMENSIONS);
export type SeriesDimension = z.infer<typeof seriesDimensionSchema>;

/** Dimensions used by categorical charts (pie, doughnut, radar, polar area, horizontal bars). */
export const CATEGORICAL_DIMENSIONS = [
  "service",
  "company",
  "borough",
  "zone",
  "hour_of_day",
  "day_of_week",
] as const;
export const categoricalDimensionSchema = z.enum(CATEGORICAL_DIMENSIONS);
export type CategoricalDimension = z.infer<typeof categoricalDimensionSchema>;

/** Numeric fields of the individual-trip sample (scatter/bubble). */
export const TRIP_FIELDS = [
  "distance",
  "duration",
  "fare",
  "tips",
  "revenue",
  "wait",
] as const;
export const tripFieldSchema = z.enum(TRIP_FIELDS);
export type TripField = z.infer<typeof tripFieldSchema>;

export const COLOR_BY = ["service", "company"] as const;
export const colorBySchema = z.enum(COLOR_BY);
export type ColorBy = z.infer<typeof colorBySchema>;

export const METRIC_DIRECTIONS = [
  "higher_is_better",
  "lower_is_better",
] as const;
export const metricDirectionSchema = z.enum(METRIC_DIRECTIONS);
export type MetricDirection = z.infer<typeof metricDirectionSchema>;

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export const sortDirectionSchema = z.enum(SORT_DIRECTIONS);
export type SortDirection = z.infer<typeof sortDirectionSchema>;
