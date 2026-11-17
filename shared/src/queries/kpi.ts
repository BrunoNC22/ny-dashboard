import { z } from "zod";

import { comparisonSchema, queryFiltersSchema } from "../filters";
import { dateRangeSchema, metricIdSchema } from "../primitives";
import { kpiEvaluationSchema } from "../widgets";
import { nullableNumber, seriesPointsSchema, statusSchema } from "./common";

export const kpiRequestSchema = z.object({
  metric: metricIdSchema,
  filters: queryFiltersSchema,
  comparison: comparisonSchema,
  evaluation: kpiEvaluationSchema,
  sparkline: z.boolean(),
});
export type KpiRequest = z.infer<typeof kpiRequestSchema>;

export const kpiResponseSchema = z.object({
  metric: metricIdSchema,
  notApplicable: z.boolean(),
  value: nullableNumber,
  comparison: z
    .object({
      range: dateRangeSchema,
      value: nullableNumber,
      deltaAbs: nullableNumber,
      deltaPct: nullableNumber,
    })
    .nullable(),
  target: nullableNumber,
  status: statusSchema,
  sparkline: seriesPointsSchema.nullable(),
});
export type KpiResponse = z.infer<typeof kpiResponseSchema>;
