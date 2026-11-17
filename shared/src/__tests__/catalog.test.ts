import { describe, expect, it } from "vitest";

import {
  applicableServices,
  computeMetric,
  dimensionValueLabel,
  formatDeltaPct,
  formatDuration,
  formatMetric,
  formatValue,
  getMetric,
  isMetricApplicable,
  METRIC_IDS,
  metricColumns,
  METRICS,
} from "../index";

/** Intl uses non-breaking spaces; normalize for readable assertions. */
const plain = (text: string) => text.replace(/\u00a0|\u202f/g, " ");

describe("metric catalog", () => {
  it("defines every metric id with label, icon and at least one service", () => {
    expect(Object.keys(METRICS).sort()).toEqual([...METRIC_IDS].sort());
    for (const id of METRIC_IDS) {
      const metric = getMetric(id);
      expect(metric.id).toBe(id);
      expect(metric.label.length).toBeGreaterThan(0);
      expect(metric.icon).toMatch(/^[a-z0-9-]+$/);
      expect(metric.services.length).toBeGreaterThan(0);
    }
  });

  it("marks plain sums as additive", () => {
    expect(METRIC_IDS.filter((id) => METRICS[id].additive).sort()).toEqual([
      "cbd_fee",
      "passengers",
      "revenue",
      "trips",
    ]);
  });

  it("lists the base columns a metric needs", () => {
    expect(metricColumns("card_pct")).toEqual(["card_trips", "cash_trips"]);
    expect(metricColumns("avg_speed")).toEqual(["distance_mi", "duration_s"]);
  });
});

describe("computeMetric", () => {
  const sums = {
    trips: 200,
    revenue: 6000,
    fare: 4000,
    tips: 600,
    distance_mi: 700,
    duration_s: 180_000, // 50 h
    airport_trips: 20,
    card_trips: 90,
    cash_trips: 10,
    wait_s: 30_000,
    wait_trips: 100,
    driver_pay: 3000,
    shared_trips: 4,
  };

  it("computes sums and ratios from base sums", () => {
    expect(computeMetric("trips", sums)).toBe(200);
    expect(computeMetric("avg_fare", sums)).toBe(20);
    expect(computeMetric("tip_pct", sums)).toBe(15);
    expect(computeMetric("revenue_per_mile", sums)).toBeCloseTo(8.571, 3);
    expect(computeMetric("avg_speed", sums)).toBe(14); // 700 mi / 50 h
    expect(computeMetric("avg_duration", sums)).toBe(900);
    expect(computeMetric("airport_pct", sums)).toBe(10);
    expect(computeMetric("card_pct", sums)).toBe(90);
    expect(computeMetric("cash_pct", sums)).toBe(10);
    expect(computeMetric("avg_wait", sums)).toBe(300);
    expect(computeMetric("driver_pay_pct", sums)).toBe(75);
    expect(computeMetric("shared_pct", sums)).toBe(2);
  });

  it("returns null without data or with a zero denominator", () => {
    expect(computeMetric("passengers", sums)).toBeNull();
    expect(
      computeMetric("card_pct", { card_trips: null, cash_trips: null }),
    ).toBeNull();
    expect(computeMetric("avg_fare", { fare: 0, trips: 0 })).toBeNull();
    expect(computeMetric("trips", {})).toBeNull();
  });

  it("treats a missing part of a multi-column denominator as zero", () => {
    expect(computeMetric("card_pct", { card_trips: 5, cash_trips: null })).toBe(
      100,
    );
  });
});

describe("applicability", () => {
  it("follows the services where the metric exists", () => {
    expect(isMetricApplicable("avg_wait", ["yellow"])).toBe(false);
    expect(isMetricApplicable("avg_wait", ["yellow", "fhvhv"])).toBe(true);
    expect(isMetricApplicable("passengers", [])).toBe(true); // empty = all services
    expect(applicableServices("card_pct", [])).toEqual(["yellow", "green"]);
    expect(applicableServices("shared_pct", ["green", "fhvhv"])).toEqual([
      "fhvhv",
    ]);
  });
});

describe("formatting (pt-BR)", () => {
  it("formats each unit", () => {
    expect(plain(formatValue(1234.5, "usd"))).toBe("US$ 1.234,50");
    expect(formatValue(1234567, "count")).toBe("1.234.567");
    expect(formatValue(12.345, "percent")).toBe("12,3%");
    expect(formatValue(3.456, "miles")).toBe("3,46 mi");
    expect(formatValue(11.71, "mph")).toBe("11,7 mph");
    expect(formatValue(750, "seconds")).toBe("12 min 30 s");
  });

  it("supports compact numbers for KPIs", () => {
    expect(plain(formatValue(20_981_078, "count", { compact: true }))).toBe(
      "21 mi",
    );
    expect(plain(formatValue(118_020_758, "usd", { compact: true }))).toBe(
      "US$ 118 mi",
    );
  });

  it("formats durations, deltas and missing values", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(3900)).toBe("1 h 05 min");
    expect(formatDeltaPct(12.34)).toBe("+12,3%");
    expect(formatDeltaPct(-4)).toBe("−4,0%");
    expect(formatDeltaPct(null)).toBe("—");
    expect(formatMetric("avg_fare", null)).toBe("—");
    expect(formatMetric("avg_fare", Number.NaN)).toBe("—");
  });
});

describe("dimension labels", () => {
  it("labels dimension values in pt-BR", () => {
    expect(dimensionValueLabel("service", "fhvhv")).toBe("Apps (Uber/Lyft)");
    expect(dimensionValueLabel("company", "other")).toBe("Outras");
    expect(dimensionValueLabel("borough", "staten_island")).toBe(
      "Staten Island",
    );
    expect(dimensionValueLabel("hour_of_day", "7")).toBe("7h");
    expect(dimensionValueLabel("day_of_week", "1")).toBe("Seg");
    expect(dimensionValueLabel("day_of_week", "7")).toBe("Dom");
    expect(dimensionValueLabel("zone", "132")).toBe("132");
    expect(dimensionValueLabel("company", "unknown-co")).toBe("unknown-co");
  });
});
