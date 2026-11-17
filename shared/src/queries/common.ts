import { z } from "zod";

import { sameLengthColumns } from "../helpers";
import { dateRangeSchema } from "../primitives";

/** Nullable number: `null` means "no data" or "not applicable". */
export const nullableNumber = z.number().nullable();

/**
 * Columnar series. `t` holds New York wall-clock timestamps without offset:
 * `YYYY-MM-DD` (day/week/month) or `YYYY-MM-DDTHH:mm` (hour).
 */
export const seriesPointsSchema = z
  .object({
    t: z.array(z.string()),
    v: z.array(nullableNumber),
  })
  .superRefine(sameLengthColumns);
export type SeriesPoints = z.infer<typeof seriesPointsSchema>;

/** A named series; `key` is the group value (e.g. "uber") or "total". */
export const seriesSchema = z.object({
  key: z.string(),
  points: seriesPointsSchema,
});
export type Series = z.infer<typeof seriesSchema>;

/** Period actually used for the comparison (resolved by the API from the comparison mode). */
export const resolvedComparisonSchema = z.object({
  range: dateRangeSchema,
});

export const STATUSES = ["good", "warning", "bad", "neutral"] as const;
export const statusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof statusSchema>;
