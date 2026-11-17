import { describe, expect, it } from "vitest";

import {
  breakdownRequestSchema,
  kpiRequestSchema,
  mapRequestSchema,
  mapResponseSchema,
  seriesPointsSchema,
  timeseriesRequestSchema,
  tripsResponseSchema,
} from "../index";
import { queryFilters } from "./fixtures";

describe("timeseriesRequestSchema", () => {
  const request = {
    metric: "trips",
    granularity: "day",
    filters: queryFilters,
    comparison: { mode: "previous_period" },
    groupBy: "company",
    includeProjection: true,
  };

  it("accepts a daily request with projection", () => {
    expect(timeseriesRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects projection on hourly granularity", () => {
    expect(
      timeseriesRequestSchema.safeParse({ ...request, granularity: "hour" })
        .success,
    ).toBe(false);
    expect(
      timeseriesRequestSchema.safeParse({
        ...request,
        granularity: "hour",
        includeProjection: false,
        comparison: { mode: "projection" },
      }).success,
    ).toBe(false);
    expect(
      timeseriesRequestSchema.safeParse({
        ...request,
        granularity: "hour",
        includeProjection: false,
      }).success,
    ).toBe(true);
  });

  it("rejects duplicated filter values", () => {
    expect(
      timeseriesRequestSchema.safeParse({
        ...request,
        filters: { ...queryFilters, services: ["yellow", "yellow"] },
      }).success,
    ).toBe(false);
  });
});

describe("kpiRequestSchema", () => {
  it("accepts comparison and target evaluation together", () => {
    expect(
      kpiRequestSchema.safeParse({
        metric: "avg_wait",
        filters: queryFilters,
        comparison: { mode: "previous_year" },
        evaluation: {
          direction: "lower_is_better",
          comparison: { enabled: true, neutralBandPct: 2 },
          target: { value: 240, warningBandPct: 10 },
        },
        sparkline: true,
      }).success,
    ).toBe(true);
  });
});

describe("breakdownRequestSchema", () => {
  const request = {
    metric: "revenue",
    dimensions: ["borough", "service"],
    filters: queryFilters,
    comparison: { mode: "none" },
    sort: "desc",
  };

  it("accepts up to two distinct dimensions", () => {
    expect(breakdownRequestSchema.safeParse(request).success).toBe(true);
    expect(
      breakdownRequestSchema.safeParse({
        ...request,
        dimensions: ["borough", "service", "company"],
      }).success,
    ).toBe(false);
  });

  it("only allows `route` alone", () => {
    expect(
      breakdownRequestSchema.safeParse({ ...request, dimensions: ["route"] })
        .success,
    ).toBe(true);
    expect(
      breakdownRequestSchema.safeParse({
        ...request,
        dimensions: ["route", "service"],
      }).success,
    ).toBe(false);
  });
});

describe("map schemas", () => {
  it("discriminates requests by mode", () => {
    expect(
      mapRequestSchema.safeParse({
        mode: "points",
        filters: queryFilters,
        colorBy: "company",
      }).success,
    ).toBe(true);
    expect(
      mapRequestSchema.safeParse({ mode: "flows", filters: queryFilters })
        .success,
    ).toBe(false);
  });

  it("requires columnar arrays with the same length", () => {
    const zones = {
      mode: "zones",
      metric: "trips",
      notApplicable: false,
      comparisonRange: null,
      columns: {
        zoneId: [132, 138],
        value: [10, null],
        comparisonValue: null,
        deltaPct: null,
      },
    };
    expect(mapResponseSchema.safeParse(zones).success).toBe(true);
    expect(
      mapResponseSchema.safeParse({
        ...zones,
        columns: { ...zones.columns, value: [10] },
      }).success,
    ).toBe(false);
  });
});

describe("columnar payloads", () => {
  it("validates series and trip columns", () => {
    expect(
      seriesPointsSchema.safeParse({ t: ["2026-09-01"], v: [1] }).success,
    ).toBe(true);
    expect(
      seriesPointsSchema.safeParse({ t: ["2026-09-01"], v: [] }).success,
    ).toBe(false);
    expect(
      tripsResponseSchema.safeParse({
        categories: ["uber", "lyft"],
        columns: { x: [1, 2], y: [3, 4], r: null, category: [0, 1] },
      }).success,
    ).toBe(true);
  });
});
