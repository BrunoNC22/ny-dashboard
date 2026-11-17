import { mapResponseSchema } from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildSamplePointsSql } from "../models/queryRepository";
import { createMapService, toCategories } from "../services/mapService";
import { createTestApp } from "./helpers";
import {
  createMemoryQueryRepository,
  type DailyFixture,
  type OdFixture,
  type SampleFixture,
} from "./memoryQueries";

const d = (
  date: string,
  zone: number,
  trips: number,
  company: DailyFixture["company"] = "uber",
): DailyFixture => ({
  date,
  service: company === "yellow" ? "yellow" : "fhvhv",
  company,
  zone,
  sums: { trips, fare: trips * 20 },
});
const daily = [
  d("2026-09-05", 132, 500),
  d("2026-09-05", 161, 300, "yellow"),
  d("2026-08-05", 132, 400),
  d("2026-08-05", 48, 100),
];
const od: OdFixture[] = [
  {
    month: "2026-09-01",
    service: "fhvhv",
    company: "uber",
    pu: 132,
    do: 161,
    sums: { trips: 90 },
  },
  {
    month: "2026-09-01",
    service: "fhvhv",
    company: "uber",
    pu: 132,
    do: 265,
    sums: { trips: 500 },
  },
  {
    month: "2026-09-01",
    service: "yellow",
    company: "yellow",
    pu: 161,
    do: 230,
    sums: { trips: 120 },
  },
  {
    month: "2026-09-01",
    service: "yellow",
    company: "yellow",
    pu: 48,
    do: 161,
    sums: { trips: 60 },
  },
];
const point = (
  service: SampleFixture["service"],
  company: SampleFixture["company"],
  zone: number,
  lon: number | null,
): SampleFixture => ({
  pickupAt: "2026-09-10 08:00:00",
  service,
  company,
  zone,
  lon,
  lat: lon === null ? null : 40.7,
  distance: 2,
  duration: 600,
  fare: 15,
  tips: 2,
  revenue: 20,
  wait: null,
});
const sample = [
  point("fhvhv", "uber", 132, -73.78),
  point("fhvhv", "lyft", 132, -73.79),
  point("yellow", "yellow", 161, -73.98),
  point("fhvhv", "uber", 264, null), // no geometry
];

const service = createMapService(
  createMemoryQueryRepository({ daily, od, sample }),
);
const filters = {
  period: { from: "2026-09-01", to: "2026-09-30" },
  services: [],
  companies: [],
  boroughs: [],
  zones: [],
};

describe("map service", () => {
  it("zones: value per pickup zone with the comparison delta", async () => {
    const response = await service.query({
      mode: "zones",
      metric: "trips",
      filters,
      comparison: { mode: "previous_period" },
    });
    expect(response).toEqual({
      mode: "zones",
      metric: "trips",
      notApplicable: false,
      comparisonRange: { from: "2026-08-01", to: "2026-08-31" },
      columns: {
        zoneId: [132, 161],
        value: [500, 300],
        comparisonValue: [400, null],
        deltaPct: [25, null],
      },
    });
  });

  it("zones: no comparison against the projection (it is not per zone)", async () => {
    const response = await service.query({
      mode: "zones",
      metric: "trips",
      filters,
      comparison: { mode: "projection" },
    });
    expect(response).toMatchObject({
      comparisonRange: null,
      columns: { comparisonValue: null, deltaPct: null },
    });
  });

  it("flows: top routes without zones lacking geometry, limited", async () => {
    const response = await service.query({
      mode: "flows",
      metric: "trips",
      filters,
      limit: 2,
    });
    expect(response).toMatchObject({
      columns: { from: [161, 132], to: [230, 161], value: [120, 90] },
    });
  });

  it("points: positioned trips with categories", async () => {
    const response = await service.query({
      mode: "points",
      filters,
      colorBy: "company",
    });
    expect(response).toEqual({
      mode: "points",
      categories: ["uber", "lyft", "yellow"],
      columns: {
        lon: [-73.78, -73.79, -73.98],
        lat: [40.7, 40.7, 40.7],
        category: [0, 1, 2],
      },
    });
    const yellow = await service.query({
      mode: "points",
      filters: { ...filters, services: ["yellow"] },
      colorBy: "service",
    });
    expect(yellow).toMatchObject({
      categories: ["yellow"],
      columns: { lon: [-73.98] },
    });
  });

  it("not applicable metrics return empty columns", async () => {
    const response = await service.query({
      mode: "zones",
      metric: "avg_wait",
      filters: { ...filters, services: ["yellow"] },
      comparison: { mode: "none" },
    });
    expect(response).toMatchObject({
      notApplicable: true,
      columns: { zoneId: [] },
    });
  });
});

describe("helpers", () => {
  it("encodes categories by first appearance", () => {
    expect(toCategories(["b", "a", "b", "c"])).toEqual({
      categories: ["b", "a", "c"],
      index: [0, 1, 0, 2],
    });
  });

  it("aggregates sample points into arrays in SQL", () => {
    const { sql, values } = buildSamplePointsSql({
      range: filters.period,
      filters: {
        services: ["fhvhv"],
        companies: [],
        boroughs: ["queens"],
        zones: [],
      },
      colorBy: "company",
    });
    expect(sql).toContain("array_agg(s.lon ORDER BY s.sample_id)");
    expect(sql).toContain("s.lon IS NOT NULL");
    expect(sql).toContain("JOIN zones z");
    expect(values).toEqual(["2026-09-01", "2026-09-30", ["fhvhv"], ["queens"]]);
  });
});

describe("POST /api/query/map", () => {
  it("returns schema-valid responses for every mode", async () => {
    const memory = createTestApp();
    const { app } = createTestApp({
      repositories: {
        ...memory.deps.repositories,
        queries: createMemoryQueryRepository({ daily, od, sample }),
      },
    });
    for (const body of [
      { mode: "zones", metric: "trips", filters, comparison: { mode: "none" } },
      { mode: "flows", metric: "trips", filters, limit: 10 },
      { mode: "points", filters, colorBy: "service" },
    ]) {
      const response = await request(app).post("/api/query/map").send(body);
      expect(response.status).toBe(200);
      expect(mapResponseSchema.parse(response.body).mode).toBe(body.mode);
    }
  });
});
