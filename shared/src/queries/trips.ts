import { z } from "zod";

import { queryFiltersSchema } from "../filters";
import { sameLengthColumns } from "../helpers";
import { colorBySchema, tripFieldSchema } from "../primitives";

/** Points of the individual-trip sample for scatter/bubble charts (all points, CLAUDE.md §8). */
export const tripsRequestSchema = z.object({
  x: tripFieldSchema,
  y: tripFieldSchema,
  r: tripFieldSchema.optional(),
  colorBy: colorBySchema,
  filters: queryFiltersSchema,
});
export type TripsRequest = z.infer<typeof tripsRequestSchema>;

export const tripsResponseSchema = z.object({
  /** Values referenced by `columns.category` (index into this list). */
  categories: z.array(z.string()),
  columns: z
    .object({
      x: z.array(z.number()),
      y: z.array(z.number()),
      r: z.array(z.number()).nullable(),
      category: z.array(z.number().int().min(0)),
    })
    .superRefine(sameLengthColumns),
});
export type TripsResponse = z.infer<typeof tripsResponseSchema>;
