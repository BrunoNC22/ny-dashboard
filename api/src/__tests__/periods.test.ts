import { describe, expect, it } from "vitest";

import {
  addMonths,
  bucketsOf,
  comparisonRange,
  daysBetween,
  previousPeriod,
  previousYear,
  weekStart,
  wholeMonths,
} from "../lib/periods";

describe("periods", () => {
  it("adds months clamping the day", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(addMonths("2026-01-15", -2)).toBe("2025-11-15");
  });

  it("detects whole calendar months", () => {
    expect(wholeMonths({ from: "2026-09-01", to: "2026-09-30" })).toBe(1);
    expect(wholeMonths({ from: "2026-07-01", to: "2026-09-30" })).toBe(3);
    expect(wholeMonths({ from: "2026-09-02", to: "2026-09-30" })).toBeNull();
    expect(daysBetween("2026-09-01", "2026-09-30")).toBe(30);
  });

  it("previous period: whole months shift by months, other ranges by days", () => {
    expect(previousPeriod({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(previousPeriod({ from: "2026-03-01", to: "2026-03-31" })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(previousPeriod({ from: "2026-07-01", to: "2026-09-30" })).toEqual({
      from: "2026-04-01",
      to: "2026-06-30",
    });
    expect(previousPeriod({ from: "2026-09-10", to: "2026-09-16" })).toEqual({
      from: "2026-09-03",
      to: "2026-09-09",
    });
  });

  it("previous year keeps the calendar", () => {
    expect(previousYear({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2025-09-01",
      to: "2025-09-30",
    });
    expect(previousYear({ from: "2025-02-01", to: "2025-02-28" })).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(previousYear({ from: "2026-09-10", to: "2026-09-16" })).toEqual({
      from: "2025-09-10",
      to: "2025-09-16",
    });
  });

  it("resolves comparison ranges", () => {
    const range = { from: "2026-09-01", to: "2026-09-30" };
    expect(comparisonRange(range, { mode: "none" })).toBeNull();
    expect(comparisonRange(range, { mode: "projection" })).toBeNull();
    const custom = { from: "2026-01-01", to: "2026-01-31" };
    expect(comparisonRange(range, { mode: "custom", range: custom })).toEqual(
      custom,
    );
  });

  it("builds buckets per granularity", () => {
    expect(weekStart("2026-09-06")).toBe("2026-08-31"); // Sunday → Monday before
    expect(weekStart("2026-09-07")).toBe("2026-09-07");
    const range = { from: "2026-08-30", to: "2026-09-08" };
    expect(bucketsOf(range, "day")).toHaveLength(10);
    expect(bucketsOf(range, "week")).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
    ]);
    expect(bucketsOf(range, "month")).toEqual(["2026-08-01", "2026-09-01"]);
    const hours = bucketsOf({ from: "2026-09-01", to: "2026-09-02" }, "hour");
    expect(hours).toHaveLength(48);
    expect(hours[0]).toBe("2026-09-01T00:00");
    expect(hours.at(-1)).toBe("2026-09-02T23:00");
  });
});
