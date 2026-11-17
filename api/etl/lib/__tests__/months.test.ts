import { describe, expect, it } from "vitest";

import { isMonth, monthRange, nextMonth, parseMonth } from "../months";

describe("months", () => {
  it("validates YYYY-MM", () => {
    expect(isMonth("2026-09")).toBe(true);
    expect(isMonth("2026-9")).toBe(false);
    expect(isMonth("2026-13")).toBe(false);
    expect(() => parseMonth("09/2026")).toThrow(/Invalid month/);
  });

  it("builds inclusive ranges across years", () => {
    expect(monthRange("2024-11", "2025-02")).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
    expect(monthRange("2024-10", "2026-09")).toHaveLength(24);
    expect(monthRange("2026-09", "2026-09")).toEqual(["2026-09"]);
    expect(() => monthRange("2026-09", "2026-08")).toThrow(/after/);
  });

  it("computes the next month", () => {
    expect(nextMonth("2024-12")).toBe("2025-01");
    expect(nextMonth("2026-09")).toBe("2026-10");
  });
});
