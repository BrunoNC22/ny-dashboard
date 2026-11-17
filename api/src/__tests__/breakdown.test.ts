import {
  type BreakdownRequest,
  breakdownResponseSchema,
} from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildBreakdownSql } from "../models/queryRepository";
import {
  BREAKDOWN_NOTICES,
  createBreakdownService,
} from "../services/breakdownService";
import { createTestApp } from "./helpers";
import {
  createMemoryQueryRepository,
  type DailyFixture,
  type HourlyFixture,
  type OdFixture,
} from "./memoryQueries";

const d = (
  date: string,
  service: DailyFixture["service"],
  company: DailyFixture["company"],
  zone: number,
  trips: number,
  fare = trips * 20,
): DailyFixture => ({ date, service, company, zone, sums: { trips, fare } });

const daily: DailyFixture[] = [
  d("2026-09-07", "fhvhv", "uber", 132, 500, 15000), // Monday
  d("2026-09-07", "fhvhv", "lyft", 132, 200, 5000),
  d("2026-09-08", "yellow", "yellow", 161, 300, 6000), // Tuesday
  d("2026-09-13", "green", "green", 48, 40, 800), // Sunday
  d("2026-08-10", "fhvhv", "uber", 132, 400, 12000),
  d("2026-08-11", "yellow", "yellow", 161, 300, 6000),
];
const hourly: HourlyFixture[] = [
  {
    hour: "2026-09-07T08:00",
    service: "fhvhv",
    company: "uber",
    sums: { trips: 50 },
  },
  {
    hour: "2026-09-07T18:00",
    service: "fhvhv",
    company: "uber",
    sums: { trips: 90 },
  },
  {
    hour: "2026-09-08T08:00",
    service: "yellow",
    company: "yellow",
    sums: { trips: 30 },
  },
];
const od: OdFixture[] = [
  {
    month: "2026-09-01",
    service: "fhvhv",
    company: "uber",
    pu: 132,
    do: 161,
    sums: { trips: 80, revenue: 6000, distance_mi: 1500, duration_s: 216_000 },
  },
  {
    month: "2026-09-01",
    service: "yellow",
    company: "yellow",
    pu: 161,
    do: 230,
    sums: { trips: 120, revenue: 2400, distance_mi: 120, duration_s: 72_000 },
  },
];
const projection = [
  {
    date: "2026-09-07",
    service: "fhvhv" as const,
    borough: "queens" as const,
    sums: { trips: 650 },
  },
  {
    date: "2026-09-08",
    service: "yellow" as const,
    borough: "manhattan" as const,
    sums: { trips: 320 },
  },
];

const zoneNames = () =>
  Promise.resolve(
    new Map([
      [48, "Clinton East"],
      [132, "JFK Airport"],
      [161, "Midtown Center"],
      [230, "Times Sq/Theatre District"],
    ]),
  );
const service = createBreakdownService(
  createMemoryQueryRepository({ daily, hourly, od, projection }),
  zoneNames,
);

const base: BreakdownRequest = {
  metric: "trips",
  dimensions: ["company"],
  filters: {
    period: { from: "2026-09-01", to: "2026-09-30" },
    services: [],
    companies: [],
    boroughs: [],
    zones: [],
  },
  comparison: { mode: "none" },
  sort: "desc",
  sortBy: "value",
};

describe("breakdown service", () => {
  it("ranks a dimension by value with labels", async () => {
    const response = await service.query(base);
    expect(response.rows.map((r) => [r.keys[0], r.labels[0], r.value])).toEqual(
      [
        ["uber", "Uber", 500],
        ["yellow", "Yellow", 300],
        ["lyft", "Lyft", 200],
        ["green", "Green", 40],
      ],
    );
    expect(response).toMatchObject({
      unit: "count",
      notApplicable: false,
      others: null,
    });
  });

  it("keeps the top N and aggregates the rest as 'Outros' from sums", async () => {
    const response = await service.query({
      ...base,
      metric: "avg_fare",
      topN: 2,
    });
    // uber 30, lyft 25, yellow 20, green 20 → others = (6000 + 800) / (300 + 40) = 20
    expect(response.rows.map((r) => [r.keys[0], r.value])).toEqual([
      ["uber", 30],
      ["lyft", 25],
    ]);
    expect(response.others).toEqual({ value: 20, comparisonValue: null });
  });

  it("orders by key for hour of day and day of week", async () => {
    const hours = await service.query({
      ...base,
      dimensions: ["hour_of_day"],
      sortBy: "key",
      sort: "asc",
    });
    expect(hours.rows.map((r) => [r.labels[0], r.value])).toEqual([
      ["8h", 80],
      ["18h", 90],
    ]);
    const days = await service.query({
      ...base,
      dimensions: ["day_of_week"],
      sortBy: "key",
      sort: "asc",
    });
    expect(days.rows.map((r) => [r.labels[0], r.value])).toEqual([
      ["Seg", 700],
      ["Ter", 300],
      ["Dom", 40],
    ]);
  });

  it("supports two dimensions and zone labels", async () => {
    const response = await service.query({
      ...base,
      dimensions: ["borough", "service"],
    });
    expect(response.rows[0]).toMatchObject({
      keys: ["queens", "fhvhv"],
      labels: ["Queens", "Apps (Uber/Lyft)"],
      value: 700,
    });
    const zones = await service.query({ ...base, dimensions: ["zone"] });
    expect(zones.rows[0]?.labels).toEqual(["JFK Airport"]);
  });

  it("compares with the previous period row by row", async () => {
    const response = await service.query({
      ...base,
      comparison: { mode: "previous_period" },
    });
    const uber = response.rows.find((r) => r.keys[0] === "uber");
    expect(uber).toMatchObject({
      value: 500,
      comparisonValue: 400,
      deltaPct: 25,
    });
    const lyft = response.rows.find((r) => r.keys[0] === "lyft");
    expect(lyft).toMatchObject({ comparisonValue: null, deltaPct: null });
  });

  it("compares with the projection per service or borough only", async () => {
    const byService = await service.query({
      ...base,
      dimensions: ["service"],
      comparison: { mode: "projection" },
    });
    expect(byService.rows.find((r) => r.keys[0] === "fhvhv")).toMatchObject({
      value: 700,
      comparisonValue: 650,
    });
    const byCompany = await service.query({
      ...base,
      comparison: { mode: "projection" },
    });
    expect(byCompany.notices).toEqual([
      BREAKDOWN_NOTICES.projectionUnavailable,
    ]);
  });

  it("breaks down routes with names, whole months and route-only metrics", async () => {
    const response = await service.query({
      ...base,
      metric: "avg_speed",
      dimensions: ["route"],
      filters: {
        ...base.filters,
        period: { from: "2026-09-10", to: "2026-09-20" },
      },
    });
    expect(response.notices).toEqual([BREAKDOWN_NOTICES.routeMonths]);
    expect(response.rows.map((r) => [r.labels[0], r.value])).toEqual([
      ["JFK Airport → Midtown Center", 25],
      ["Midtown Center → Times Sq/Theatre District", 6],
    ]);
    const fare = await service.query({
      ...base,
      metric: "avg_fare",
      dimensions: ["route"],
    });
    expect(fare).toMatchObject({
      notApplicable: true,
      notices: [BREAKDOWN_NOTICES.routeMetric],
    });
  });

  it("rejects hour of day combined with boroughs or zones", async () => {
    await expect(
      service.query({ ...base, dimensions: ["hour_of_day", "borough"] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.query({
        ...base,
        dimensions: ["hour_of_day"],
        filters: { ...base.filters, zones: [132] },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("breakdown SQL", () => {
  it("picks the source table from the dimensions", () => {
    const filters = {
      services: ["yellow" as const],
      companies: [],
      boroughs: [],
      zones: [],
    };
    const range = base.filters.period;
    expect(
      buildBreakdownSql({
        range,
        filters,
        dimensions: ["route"],
        columns: ["trips"],
      }).sql,
    ).toContain("FROM od_flow_monthly");
    expect(
      buildBreakdownSql({
        range,
        filters,
        dimensions: ["hour_of_day"],
        columns: ["trips"],
      }).sql,
    ).toContain("extract(hour FROM h.hour)");
    const daily = buildBreakdownSql({
      range,
      filters,
      dimensions: ["borough", "day_of_week"],
      columns: ["trips"],
    }).sql;
    expect(daily).toContain("JOIN zones z");
    expect(daily).toContain("extract(isodow FROM d.date)");
  });
});

describe("POST /api/query/breakdown", () => {
  it("returns a schema-valid response with zone labels from the data repository", async () => {
    const memory = createTestApp();
    const { app } = createTestApp({
      repositories: {
        ...memory.deps.repositories,
        queries: createMemoryQueryRepository({ daily, hourly, od, projection }),
      },
    });
    const response = await request(app)
      .post("/api/query/breakdown")
      .send({ ...base, dimensions: ["zone"] });
    expect(response.status).toBe(200);
    const body = breakdownResponseSchema.parse(response.body);
    expect(body.rows[0]?.labels).toEqual(["JFK Airport"]); // from the in-memory zones
  });
});
