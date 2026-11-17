import { BASE_COLUMNS } from "@ny-dashboard/shared";
import { describe, expect, it } from "vitest";

import { addDays, dateRange } from "../lib/periods";
import {
  buildProjections,
  type DailySeries,
  PROJECTED_COLUMNS,
} from "../seed/projections";

/** Oct 1 → Dec 31 2024 with weekly seasonality and a trend. */
const series = (): DailySeries => {
  const dates = dateRange("2024-10-01", "2024-12-31");
  return {
    dates,
    values: {
      trips: dates.map(
        (_, t) => 1000 + 3 * t + ([0, 50, 80, 90, 150, 200, -40][t % 7] ?? 0),
      ),
      revenue: dates.map((_, t) => 30_000 + 90 * t),
    },
  };
};

describe("dates", () => {
  it("adds days and builds inclusive ranges across months and years", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
    expect(dateRange("2024-12-30", "2025-01-02")).toEqual([
      "2024-12-30",
      "2024-12-31",
      "2025-01-01",
      "2025-01-02",
    ]);
  });
});

describe("buildProjections", () => {
  it("backtests every month after the first and forecasts until the horizon", () => {
    const rows = buildProjections(series(), "2025-01-15");
    const backtest = rows.filter((row) => row.kind === "backtest");
    const forecast = rows.filter((row) => row.kind === "forecast");
    expect(backtest[0]?.date).toBe("2024-11-01"); // October is warm-up
    expect(backtest.at(-1)?.date).toBe("2024-12-31");
    expect(backtest).toHaveLength(30 + 31);
    expect(forecast.map((row) => row.date)).toEqual(
      dateRange("2025-01-01", "2025-01-15"),
    );
  });

  it("never uses the data of month M to project month M", () => {
    const base = series();
    const changed = structuredClone(base);
    // Change every day of December: the December backtest must not move.
    changed.values.trips = (changed.values.trips ?? []).map((value, i) =>
      (base.dates[i] ?? "") >= "2024-12-01" ? value * 10 : value,
    );
    const december = (s: DailySeries) =>
      buildProjections(s, "2024-12-31")
        .filter((row) => row.kind === "backtest" && row.date >= "2024-12-01")
        .map((row) => row.values.trips);
    expect(december(changed)).toEqual(december(base));
  });

  it("projects every column it receives, close to the real values", () => {
    const rows = buildProjections(series(), "2024-12-31");
    const real = series();
    const decemberFirst = rows.find((row) => row.date === "2024-12-01");
    const i = real.dates.indexOf("2024-12-01");
    expect(Object.keys(decemberFirst?.values ?? {})).toEqual([
      "trips",
      "revenue",
    ]);
    expect(decemberFirst?.values.trips).toBeCloseTo(
      real.values.trips?.[i] ?? 0,
      -2,
    );
    expect(decemberFirst?.values.revenue).toBeCloseTo(
      real.values.revenue?.[i] ?? 0,
      -3,
    );
  });

  it("returns nothing for an empty series and clamps at zero", () => {
    expect(buildProjections({ dates: [], values: {} }, "2025-01-01")).toEqual(
      [],
    );
    const falling = dateRange("2024-10-01", "2024-11-30");
    const rows = buildProjections(
      {
        dates: falling,
        values: { trips: falling.map((_, t) => Math.max(0, 600 - 10 * t)) },
      },
      "2025-01-31",
    );
    expect(
      Math.min(...rows.map((row) => row.values.trips ?? 0)),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("projected columns", () => {
  it("only projects columns that exist for each service", () => {
    expect(PROJECTED_COLUMNS.fhvhv).not.toContain("passengers");
    expect(PROJECTED_COLUMNS.fhvhv).toContain("wait_s");
    expect(PROJECTED_COLUMNS.yellow).not.toContain("driver_pay");
    expect(PROJECTED_COLUMNS.green).toContain("card_trips");
    for (const columns of Object.values(PROJECTED_COLUMNS)) {
      expect(columns).toContain("trips");
      expect(columns.every((c) => BASE_COLUMNS.includes(c))).toBe(true);
    }
  });
});
