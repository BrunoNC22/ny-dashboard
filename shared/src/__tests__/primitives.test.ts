import { describe, expect, it } from "vitest";

import {
  comparisonSchema,
  dateRangeSchema,
  metricIdSchema,
  zoneIdSchema,
} from "../index";

describe("dateRangeSchema", () => {
  it("accepts an inclusive range, including a single day", () => {
    expect(
      dateRangeSchema.safeParse({ from: "2026-08-01", to: "2026-09-30" })
        .success,
    ).toBe(true);
    expect(
      dateRangeSchema.safeParse({ from: "2026-09-01", to: "2026-09-01" })
        .success,
    ).toBe(true);
  });

  it("rejects reversed ranges and malformed dates", () => {
    expect(
      dateRangeSchema.safeParse({ from: "2026-09-30", to: "2026-09-01" })
        .success,
    ).toBe(false);
    expect(
      dateRangeSchema.safeParse({ from: "2026-9-1", to: "2026-09-30" }).success,
    ).toBe(false);
    expect(
      dateRangeSchema.safeParse({ from: "2026-02-30", to: "2026-03-01" })
        .success,
    ).toBe(false);
  });
});

describe("comparisonSchema", () => {
  it("requires a range only for custom comparisons", () => {
    expect(comparisonSchema.safeParse({ mode: "previous_year" }).success).toBe(
      true,
    );
    expect(comparisonSchema.safeParse({ mode: "custom" }).success).toBe(false);
    expect(
      comparisonSchema.safeParse({
        mode: "custom",
        range: { from: "2026-08-01", to: "2026-08-31" },
      }).success,
    ).toBe(true);
  });

  it("rejects unknown modes", () => {
    expect(comparisonSchema.safeParse({ mode: "last_week" }).success).toBe(
      false,
    );
  });
});

describe("ids", () => {
  it("validates metric ids and zone ids", () => {
    expect(metricIdSchema.safeParse("avg_wait").success).toBe(true);
    expect(metricIdSchema.safeParse("unknown_metric").success).toBe(false);
    expect(zoneIdSchema.safeParse(132).success).toBe(true);
    expect(zoneIdSchema.safeParse(0).success).toBe(false);
    expect(zoneIdSchema.safeParse(1.5).success).toBe(false);
  });
});
