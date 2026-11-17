import { metaResponseSchema } from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createTestApp } from "./helpers";

describe("GET /api/meta", () => {
  it("is public and describes the loaded data", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/meta");
    expect(response.status).toBe(200);
    const meta = metaResponseSchema.parse(response.body);
    expect(meta.period).toEqual({ from: "2024-10-01", to: "2026-09-30" });
    expect(meta.projection).toEqual({
      backtestFrom: "2024-11-01",
      until: "2026-12-31",
    });
    expect(meta.sampleMonth).toBe("2026-09");
    expect(meta.companies).toContainEqual({
      id: "uber",
      label: "Uber",
      service: "fhvhv",
    });
    expect(meta.services.map((s) => s.id)).toEqual([
      "yellow",
      "green",
      "fhvhv",
    ]);
    expect(meta.boroughs).toContainEqual({
      id: "staten_island",
      label: "Staten Island",
    });
    expect(meta.zones).toContainEqual({
      id: 132,
      name: "JFK Airport",
      borough: "queens",
    });
    expect(meta.metrics).toHaveLength(17);
    expect(meta.dimensions.map((d) => d.id)).toContain("hour_of_day");
  });

  it("computes the metadata once", async () => {
    const { app, deps } = createTestApp();
    const spy = vi.spyOn(deps.repositories.data, "getCoverage");
    await request(app).get("/api/meta");
    await request(app).get("/api/meta");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("answers 503 NO_DATA before the seed and retries afterwards", async () => {
    const { app, data } = createTestApp();
    const loaded = { ...data.coverage };
    data.coverage.firstDate = null;
    data.coverage.lastDate = null;
    const before = await request(app).get("/api/meta");
    expect(before.status).toBe(503);
    expect(before.body).toMatchObject({ error: { code: "NO_DATA" } });

    Object.assign(data.coverage, loaded);
    expect((await request(app).get("/api/meta")).status).toBe(200);
  });
});

describe("GET /api/zones", () => {
  it("serves the zones GeoJSON with cache headers and revalidation", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/zones");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/geo\+json/);
    expect(response.headers["cache-control"]).toMatch(/max-age=86400/);
    const etag = String(response.headers.etag);
    expect(etag).toMatch(/^"[0-9a-f]{40}"$/);

    const geojson = JSON.parse(response.text) as { features: { id: number }[] };
    expect(geojson.features).toHaveLength(263);

    const cached = await request(app)
      .get("/api/zones")
      .set("If-None-Match", etag);
    expect(cached.status).toBe(304);
    expect(cached.text).toBe("");
  });
});
