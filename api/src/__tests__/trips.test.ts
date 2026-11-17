import { TRIP_FIELDS_CATALOG, tripsResponseSchema } from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildSampleTripsSql } from "../models/queryRepository";
import { createTripsService } from "../services/tripsService";
import { createTestApp } from "./helpers";
import {
  createMemoryQueryRepository,
  type SampleFixture,
} from "./memoryQueries";

const trip = (
  hour: string,
  service: SampleFixture["service"],
  company: SampleFixture["company"],
  distance: number,
  fare: number,
  wait: number | null = null,
): SampleFixture => ({
  pickupAt: `2026-09-10 ${hour}:00:00`,
  service,
  company,
  zone: service === "yellow" ? 161 : 132,
  lon: -73.9,
  lat: 40.7,
  distance,
  duration: distance * 300,
  fare,
  tips: fare / 10,
  revenue: fare * 1.3,
  wait,
});
const sample = [
  trip("08", "yellow", "yellow", 2, 12),
  trip("23", "fhvhv", "uber", 10, 40, 240),
  trip("02", "fhvhv", "lyft", 5, 22, 180),
  trip("14", "green", "green", 3, 15),
];
const service = createTripsService(createMemoryQueryRepository({ sample }));
const filters = {
  period: { from: "2026-09-01", to: "2026-09-30" },
  services: [],
  companies: [],
  boroughs: [],
  zones: [],
};

describe("trips service", () => {
  it("returns every point as columns with category indices", async () => {
    const response = await service.query({
      x: "distance",
      y: "fare",
      colorBy: "service",
      filters,
    });
    expect(response).toEqual({
      categories: ["yellow", "fhvhv", "green"],
      columns: {
        x: [2, 10, 5, 3],
        y: [12, 40, 22, 15],
        r: null,
        category: [0, 1, 1, 2],
      },
    });
  });

  it("adds the bubble radius and filters by hour window (wrapping midnight)", async () => {
    const night = await service.query({
      x: "distance",
      y: "fare",
      r: "tips",
      colorBy: "company",
      filters,
      hours: { from: 22, to: 4 },
    });
    expect(night.categories).toEqual(["uber", "lyft"]);
    expect(night.columns.r).toEqual([4, 2.2]);
  });

  it("only uses services that have every requested field", async () => {
    const wait = await service.query({
      x: "wait",
      y: "fare",
      colorBy: "company",
      filters,
    });
    expect(wait.columns.x).toEqual([240, 180]);
    const none = await service.query({
      x: "wait",
      y: "fare",
      colorBy: "company",
      filters: { ...filters, services: ["yellow"] },
    });
    expect(none.columns).toEqual({ x: [], y: [], r: null, category: [] });
  });

  it("maps every trip field to a sample column", () => {
    expect(Object.values(TRIP_FIELDS_CATALOG).map((f) => f.column)).toEqual([
      "distance_mi",
      "duration_s",
      "fare",
      "tips",
      "revenue",
      "wait_s",
    ]);
  });
});

describe("trips SQL", () => {
  it("whitelists columns and builds the hour window", () => {
    const base = {
      range: filters.period,
      filters: {
        services: ["fhvhv" as const],
        companies: [],
        boroughs: [],
        zones: [],
      },
      x: "distance_mi" as const,
      y: "fare" as const,
      colorBy: "company" as const,
    };
    const wrapped = buildSampleTripsSql({
      ...base,
      hours: { from: 22, to: 4 },
    }).sql;
    expect(wrapped).toContain("extract(hour FROM s.pickup_at) >=");
    expect(wrapped).toContain(" OR ");
    expect(buildSampleTripsSql(base).sql).toContain("NULL AS r");
    expect(() =>
      buildSampleTripsSql({ ...base, x: "password" as never }),
    ).toThrow(/Unknown sample column/);
  });
});

describe("POST /api/query/trips", () => {
  it("returns a schema-valid, gzip-compressed response when asked", async () => {
    const memory = createTestApp();
    const many = Array.from({ length: 500 }, (_, i) =>
      trip("10", "yellow", "yellow", i, i * 3),
    );
    const { app } = createTestApp({
      repositories: {
        ...memory.deps.repositories,
        queries: createMemoryQueryRepository({ sample: many }),
      },
    });
    const response = await request(app)
      .post("/api/query/trips")
      .set("Accept-Encoding", "gzip")
      .send({ x: "distance", y: "fare", colorBy: "service", filters });
    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(tripsResponseSchema.parse(response.body).columns.x).toHaveLength(
      500,
    );
  });
});
