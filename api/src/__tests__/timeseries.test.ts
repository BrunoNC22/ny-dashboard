import {
  apiErrorSchema,
  type TimeseriesRequest,
  timeseriesResponseSchema,
} from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildSeriesSql } from "../models/queryRepository";
import {
  createTimeseriesService,
  NOTICES,
} from "../services/timeseriesService";
import { createTestApp } from "./helpers";
import {
  createMemoryQueryRepository,
  type DailyFixture,
} from "./memoryQueries";

const trip = (
  date: string,
  service: DailyFixture["service"],
  company: DailyFixture["company"],
  zone: number,
  trips: number,
  extra: DailyFixture["sums"] = {},
): DailyFixture => ({
  date,
  service,
  company,
  zone,
  sums: { trips, fare: trips * 20, revenue: trips * 30, ...extra },
});

const daily: DailyFixture[] = [
  // August 2026
  trip("2026-08-01", "yellow", "yellow", 161, 100),
  trip("2026-08-15", "fhvhv", "uber", 132, 300, {
    wait_s: 3000,
    wait_trips: 300,
  }),
  // September 2026 (no data on 09-02)
  trip("2026-09-01", "yellow", "yellow", 161, 120),
  trip("2026-09-01", "fhvhv", "uber", 132, 400, {
    wait_s: 2000,
    wait_trips: 400,
  }),
  trip("2026-09-01", "fhvhv", "lyft", 48, 100, {
    wait_s: 1000,
    wait_trips: 100,
  }),
  trip("2026-09-03", "yellow", "yellow", 132, 80),
  // September 2025 (previous year)
  trip("2025-09-05", "yellow", "yellow", 161, 500),
];

const projection = [
  {
    date: "2026-09-01",
    service: "yellow" as const,
    borough: "manhattan" as const,
    sums: { trips: 110, fare: 2200 },
  },
  {
    date: "2026-09-01",
    service: "fhvhv" as const,
    borough: "queens" as const,
    sums: { trips: 450, fare: 9000 },
  },
  {
    date: "2026-09-03",
    service: "yellow" as const,
    borough: "queens" as const,
    sums: { trips: 90, fare: 1800 },
  },
];

const service = createTimeseriesService(
  createMemoryQueryRepository({ daily, projection }),
);

const base: TimeseriesRequest = {
  metric: "trips",
  granularity: "day",
  filters: {
    period: { from: "2026-09-01", to: "2026-09-03" },
    services: [],
    companies: [],
    boroughs: [],
    zones: [],
  },
  comparison: { mode: "none" },
  includeProjection: false,
};

describe("timeseries service", () => {
  it("returns one point per bucket, null where there is no data at all", async () => {
    const response = await service.query(base);
    expect(response).toMatchObject({
      unit: "count",
      notApplicable: false,
      notices: [],
    });
    expect(response.series).toEqual([
      {
        key: "total",
        points: {
          t: ["2026-09-01", "2026-09-02", "2026-09-03"],
          v: [620, null, 80],
        },
      },
    ]);
  });

  it("computes ratio metrics from sums", async () => {
    const response = await service.query({ ...base, metric: "avg_fare" });
    expect(response.series[0]?.points.v).toEqual([20, null, 20]);
  });

  it("restricts a metric to the services where it exists", async () => {
    const wait = await service.query({ ...base, metric: "avg_wait" });
    // only FHVHV rows: (2000 + 1000) / (400 + 100) = 6 s on 09-01; 09-03 only has yellow → 0 trips
    expect(wait.series[0]?.points.v).toEqual([6, null, null]);

    const notApplicable = await service.query({
      ...base,
      metric: "avg_wait",
      filters: { ...base.filters, services: ["yellow"] },
    });
    expect(notApplicable).toMatchObject({ notApplicable: true, series: [] });
  });

  it("groups by company, filling missing buckets with zero", async () => {
    const response = await service.query({ ...base, groupBy: "company" });
    expect(response.series.map((s) => [s.key, s.points.v])).toEqual([
      ["lyft", [100, null, 0]],
      ["uber", [400, null, 0]],
      ["yellow", [120, null, 80]],
    ]);
  });

  it("filters by borough and zone", async () => {
    const queens = await service.query({
      ...base,
      filters: { ...base.filters, boroughs: ["queens"] },
    });
    expect(queens.series[0]?.points.v).toEqual([400, null, 80]);
    const zone = await service.query({
      ...base,
      filters: { ...base.filters, zones: [48] },
    });
    expect(zone.series[0]?.points.v).toEqual([100, null, null]);
  });

  it("compares whole months with the previous month and computes the delta", async () => {
    const response = await service.query({
      ...base,
      filters: {
        ...base.filters,
        period: { from: "2026-09-01", to: "2026-09-30" },
      },
      comparison: { mode: "previous_period" },
      granularity: "month",
    });
    expect(response.series[0]?.points).toEqual({ t: ["2026-09-01"], v: [700] });
    expect(response.comparison?.range).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(response.comparison?.totals).toEqual({
      current: 700,
      comparison: 400,
      deltaPct: 75,
    });
  });

  it("compares with the same period of the previous year", async () => {
    const response = await service.query({
      ...base,
      filters: {
        ...base.filters,
        period: { from: "2026-09-01", to: "2026-09-30" },
      },
      comparison: { mode: "previous_year" },
      granularity: "week",
    });
    expect(response.comparison?.range).toEqual({
      from: "2025-09-01",
      to: "2025-09-30",
    });
    expect(response.comparison?.totals.comparison).toBe(500);
  });

  it("returns the projection overlay and the projection comparison", async () => {
    const response = await service.query({
      ...base,
      comparison: { mode: "projection" },
      includeProjection: true,
    });
    expect(response.projection?.series[0]?.points.v).toEqual([560, null, 90]);
    expect(response.comparison?.range).toEqual(base.filters.period);
    expect(response.comparison?.totals).toEqual({
      current: 700,
      comparison: 650,
      deltaPct: (100 * 50) / 650,
    });
  });

  it("explains when the projection is not available", async () => {
    const byCompany = await service.query({
      ...base,
      includeProjection: true,
      filters: { ...base.filters, companies: ["uber"] },
    });
    expect(byCompany.projection).toBeNull();
    expect(byCompany.notices).toEqual([NOTICES.projectionFilters]);

    const grouped = await service.query({
      ...base,
      includeProjection: true,
      groupBy: "company",
    });
    expect(grouped.notices).toEqual([NOTICES.projectionByCompany]);
    expect(grouped.projection?.series.map((s) => s.key)).toEqual(["total"]);
  });

  it("rejects hourly queries filtered or grouped by borough/zone", async () => {
    await expect(
      service.query({
        ...base,
        granularity: "hour",
        filters: { ...base.filters, boroughs: ["queens"] },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(() =>
      buildSeriesSql({
        granularity: "hour",
        range: base.filters.period,
        filters: {
          services: ["yellow"],
          companies: [],
          boroughs: [],
          zones: [1],
        },
        columns: ["trips"],
      }),
    ).toThrow(/no zone/);
  });
});

describe("SQL builder", () => {
  it("parameterizes values and joins zones only when needed", () => {
    const plain = buildSeriesSql({
      granularity: "week",
      range: base.filters.period,
      filters: {
        services: ["yellow", "fhvhv"],
        companies: [],
        boroughs: [],
        zones: [],
      },
      columns: ["trips", "fare"],
    });
    expect(plain.sql).toContain("date_trunc('week', d.date)");
    expect(plain.sql).not.toContain("JOIN zones");
    expect(plain.values).toEqual([
      "2026-09-01",
      "2026-09-03",
      ["yellow", "fhvhv"],
    ]);

    const borough = buildSeriesSql({
      granularity: "day",
      range: base.filters.period,
      filters: {
        services: ["yellow"],
        companies: ["yellow"],
        boroughs: ["queens"],
        zones: [132],
      },
      groupBy: "borough",
      columns: ["trips"],
    });
    expect(borough.sql).toContain("JOIN zones z");
    expect(borough.sql).toContain("z.borough AS grp");
    expect(borough.values).toHaveLength(6);
  });
});

describe("POST /api/query/timeseries", () => {
  it("is public and returns a schema-valid response", async () => {
    const { app } = createTestApp({
      repositories: {
        ...createTestApp().deps.repositories,
        queries: createMemoryQueryRepository({ daily, projection }),
      },
    });
    const response = await request(app)
      .post("/api/query/timeseries")
      .send(base);
    expect(response.status).toBe(200);
    expect(timeseriesResponseSchema.parse(response.body).series[0]?.key).toBe(
      "total",
    );
  });

  it("validates the request", async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post("/api/query/timeseries")
      .send({ ...base, granularity: "hour", includeProjection: true });
    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(response.body).error.code).toBe(
      "VALIDATION_ERROR",
    );
  });
});
