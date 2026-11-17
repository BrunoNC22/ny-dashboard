import { z } from "zod";

import { UNITS } from "../catalog/metrics";
import { comparisonSchema, queryFiltersSchema } from "../filters";
import {
  dateRangeSchema,
  granularitySchema,
  metricIdSchema,
  seriesDimensionSchema,
} from "../primitives";
import { nullableNumber, seriesSchema } from "./common";

export const timeseriesRequestSchema = z
  .object({
    metric: metricIdSchema,
    granularity: granularitySchema,
    filters: queryFiltersSchema,
    comparison: comparisonSchema,
    groupBy: seriesDimensionSchema.optional(),
    includeProjection: z.boolean(),
  })
  .refine((req) => !(req.includeProjection && req.granularity === "hour"), {
    message: "Projection is only available for daily or coarser granularity",
    path: ["includeProjection"],
  })
  .refine(
    (req) =>
      !(req.comparison.mode === "projection" && req.granularity === "hour"),
    {
      message:
        "Projection comparison is only available for daily or coarser granularity",
      path: ["comparison"],
    },
  );
export type TimeseriesRequest = z.infer<typeof timeseriesRequestSchema>;

export const timeseriesResponseSchema = z.object({
  metric: metricIdSchema,
  granularity: granularitySchema,
  /** Unit of the values (for formatting). */
  unit: z.enum(UNITS),
  /** Human-readable notes (pt-BR), e.g. why the projection is not available. */
  notices: z.array(z.string()),
  /** True when the metric does not exist for the selected services (e.g. passengers on FHVHV). */
  notApplicable: z.boolean(),
  series: z.array(seriesSchema),
  /** Present when a comparison was requested. Points keep their original timestamps. */
  comparison: z
    .object({
      range: dateRangeSchema,
      series: z.array(seriesSchema),
      totals: z.object({
        current: nullableNumber,
        comparison: nullableNumber,
        deltaPct: nullableNumber,
      }),
    })
    .nullable(),
  projection: z.object({ series: z.array(seriesSchema) }).nullable(),
});
export type TimeseriesResponse = z.infer<typeof timeseriesResponseSchema>;
