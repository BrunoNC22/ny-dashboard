import { z } from "zod";

import { comparisonSchema, queryFiltersSchema } from "../filters";
import { uniqueArray } from "../helpers";
import {
  dimensionSchema,
  metricIdSchema,
  sortDirectionSchema,
} from "../primitives";
import { nullableNumber } from "./common";

export const breakdownRequestSchema = z
  .object({
    metric: metricIdSchema,
    /** One or two dimensions (e.g. borough × service). `route` must be used alone. */
    dimensions: uniqueArray(dimensionSchema).min(1).max(2),
    filters: queryFiltersSchema,
    comparison: comparisonSchema,
    sort: sortDirectionSchema,
    topN: z.number().int().min(1).max(500).optional(),
  })
  .refine(
    (req) => !(req.dimensions.includes("route") && req.dimensions.length > 1),
    {
      message: "`route` cannot be combined with another dimension",
      path: ["dimensions"],
    },
  );
export type BreakdownRequest = z.infer<typeof breakdownRequestSchema>;

export const breakdownRowSchema = z.object({
  /** Raw dimension values, in the same order as `dimensions`. */
  keys: z.array(z.string()),
  /** Display labels (pt-BR), same order as `keys`. */
  labels: z.array(z.string()),
  value: nullableNumber,
  comparisonValue: nullableNumber,
  deltaPct: nullableNumber,
});
export type BreakdownRow = z.infer<typeof breakdownRowSchema>;

export const breakdownResponseSchema = z.object({
  metric: metricIdSchema,
  dimensions: z.array(dimensionSchema),
  notApplicable: z.boolean(),
  rows: z.array(breakdownRowSchema),
  /** Aggregate of the rows cut by `topN` ("Outros"). */
  others: z
    .object({ value: nullableNumber, comparisonValue: nullableNumber })
    .nullable(),
});
export type BreakdownResponse = z.infer<typeof breakdownResponseSchema>;
