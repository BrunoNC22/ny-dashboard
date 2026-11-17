import { z } from "zod";

/** Array whose items must be unique (compared with `Set` semantics). */
export const uniqueArray = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((items) => new Set(items).size === items.length, {
    message: "Items must be unique",
  });

/**
 * Validates that every array-valued field of a columnar payload has the same length.
 * Null fields (optional columns) are ignored.
 */
export const sameLengthColumns = (
  value: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void => {
  let expected: number | undefined;
  for (const [key, column] of Object.entries(value)) {
    if (!Array.isArray(column)) continue;
    if (expected === undefined) {
      expected = column.length;
    } else if (column.length !== expected) {
      ctx.addIssue({
        code: "custom",
        message: `Column "${key}" has ${String(column.length)} items, expected ${String(expected)}`,
        path: [key],
      });
    }
  }
};
