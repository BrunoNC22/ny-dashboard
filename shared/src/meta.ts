import { z } from "zod";

import {
  boroughSchema,
  companySchema,
  dateRangeSchema,
  dimensionSchema,
  isoDateSchema,
  metricDirectionSchema,
  metricIdSchema,
  serviceSchema,
  zoneIdSchema,
} from "./primitives";

const labeled = <T extends z.ZodType>(id: T) =>
  z.object({ id, label: z.string() });

/** Serializable metric definition (same shape as the shared catalog). */
export const metricDefinitionSchema = z.object({
  id: metricIdSchema,
  label: z.string(),
  description: z.string(),
  category: z.string(),
  unit: z.string(),
  formula: z.object({
    numerator: z.array(z.string()),
    denominator: z.array(z.string()).optional(),
    scale: z.number().optional(),
  }),
  services: z.array(serviceSchema),
  direction: metricDirectionSchema,
  icon: z.string(),
  additive: z.boolean(),
});

/** Response of `GET /api/meta`: what the loaded data covers and how to label it. */
export const metaResponseSchema = z.object({
  /** Days with trip data. */
  period: dateRangeSchema,
  projection: z.object({
    /** First day with a backtest projection (second month of data). */
    backtestFrom: isoDateSchema.nullable(),
    /** Last projected day (forecast horizon). */
    until: isoDateSchema.nullable(),
  }),
  /** Month (YYYY-MM) of the individual-trip sample. */
  sampleMonth: z.string().nullable(),
  services: z.array(labeled(serviceSchema)),
  companies: z.array(labeled(companySchema).extend({ service: serviceSchema })),
  boroughs: z.array(labeled(boroughSchema)),
  zones: z.array(
    z.object({ id: zoneIdSchema, name: z.string(), borough: boroughSchema }),
  ),
  dimensions: z.array(labeled(dimensionSchema).extend({ icon: z.string() })),
  metrics: z.array(metricDefinitionSchema),
});
export type MetaResponse = z.infer<typeof metaResponseSchema>;
