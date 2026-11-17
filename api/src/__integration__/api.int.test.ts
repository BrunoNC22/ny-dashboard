import {
  breakdownResponseSchema,
  createDefaultDashboard,
  dashboardResponseSchema,
  kpiResponseSchema,
  mapResponseSchema,
  metaResponseSchema,
  preferencesResponseSchema,
  timeseriesResponseSchema,
  tripsResponseSchema,
} from "@ny-dashboard/shared";
import pg from "pg";
import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createApp } from "../app";
import { createDependencies } from "../container";
import { ZONES_DIR } from "../lib/paths";
import { dateRange } from "../lib/periods";
import { createPrisma } from "../lib/prisma";
import { DEMO_USER } from "../seed/demo";
import { runSeed } from "../seed/run";
import { dailyTrips } from "./snapshotFixture";

const databaseUrl = inject("databaseUrl");
const prisma = createPrisma(databaseUrl);
const app = createApp(
  createDependencies(
    prisma,
    {
      JWT_SECRET: "integration-secret-with-length",
      JWT_EXPIRES_IN: "1h",
      COOKIE_SECURE: false,
    },
    pino({ level: "silent" }),
  ),
);

afterAll(async () => {
  await prisma.$disconnect();
});

const sum = (dates: string[], source: "yellow" | "uber" | "lyft") =>
  dates.reduce((total, date) => total + dailyTrips(date, source), 0);
const SEPTEMBER = dateRange("2026-09-01", "2026-09-30");
const AUGUST = dateRange("2026-08-01", "2026-08-31");
const tripsIn = (dates: string[]) =>
  sum(dates, "yellow") + sum(dates, "uber") + sum(dates, "lyft");

const filters = {
  period: { from: "2026-09-01", to: "2026-09-30" },
  services: [],
  companies: [],
  boroughs: [],
  zones: [],
};

describe("seed (fixture snapshot loaded by globalSetup)", () => {
  it("is idempotent: the same snapshot is not loaded twice", async () => {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    try {
      const result = await runSeed({
        pool,
        prisma,
        snapshotDir: inject("snapshotDir"),
        zonesDir: ZONES_DIR,
        log: () => undefined,
      });
      expect(result).toMatchObject({ data: "skipped", demoUserCreated: false });
    } finally {
      await pool.end();
    }
    expect(await prisma.zone.count()).toBe(265);
    expect(await prisma.tripDaily.count()).toBe(
      (AUGUST.length + SEPTEMBER.length) * 3,
    );
    expect(
      await prisma.projection.count({ where: { kind: "backtest" } }),
    ).toBeGreaterThan(0);
  });
});

describe("auth, dashboard and preferences", () => {
  let agent: ReturnType<typeof request.agent>;
  beforeAll(() => {
    agent = request.agent(app);
  });

  it("logs in as the demo user created by the seed", async () => {
    const login = await agent.post("/api/auth/login").send(DEMO_USER);
    expect(login.status).toBe(200);
    expect((await agent.get("/api/auth/me")).body).toMatchObject({
      user: { username: "demo" },
    });
  });

  it("serves and saves the dashboard state", async () => {
    const initial = dashboardResponseSchema.parse(
      (await agent.get("/api/dashboard")).body,
    );
    expect(initial.state).toEqual(createDefaultDashboard());

    const state = createDefaultDashboard();
    state.filters.services = ["fhvhv"];
    const saved = await agent.put("/api/dashboard").send({ state });
    expect(saved.status).toBe(200);
    const reloaded = dashboardResponseSchema.parse(
      (await agent.get("/api/dashboard")).body,
    );
    expect(reloaded.state.filters.services).toEqual(["fhvhv"]);
  });

  it("saves preferences", async () => {
    await agent
      .put("/api/preferences")
      .send({ theme: "light", palette: "sunset" });
    const prefs = preferencesResponseSchema.parse(
      (await agent.get("/api/preferences")).body,
    );
    expect(prefs.preferences).toEqual({ theme: "light", palette: "sunset" });
  });

  it("registers new users with their own default dashboard and rejects duplicates", async () => {
    const other = request.agent(app);
    const created = await other
      .post("/api/auth/register")
      .send({ username: "integra", password: "senha1234" });
    expect(created.status).toBe(201);
    const dashboard = dashboardResponseSchema.parse(
      (await other.get("/api/dashboard")).body,
    );
    expect(dashboard.state.filters.services).toEqual([]); // not the demo user's change
    const again = await request(app)
      .post("/api/auth/register")
      .send({ username: "integra", password: "senha1234" });
    expect(again.status).toBe(409);
    await other.post("/api/auth/logout");
    expect((await other.get("/api/dashboard")).status).toBe(401);
  });
});

describe("meta and zones", () => {
  it("describes the loaded data", async () => {
    const meta = metaResponseSchema.parse(
      (await request(app).get("/api/meta")).body,
    );
    expect(meta.period).toEqual({ from: "2026-08-01", to: "2026-09-30" });
    expect(meta.projection.backtestFrom).toBe("2026-09-01");
    expect(meta.sampleMonth).toBe("2026-09");
    expect(meta.companies.map((c) => c.id).sort()).toEqual([
      "lyft",
      "uber",
      "yellow",
    ]);
    expect(meta.zones).toHaveLength(265);
  });

  it("serves the zones with ETag revalidation", async () => {
    const first = await request(app).get("/api/zones");
    const second = await request(app)
      .get("/api/zones")
      .set("If-None-Match", String(first.headers.etag));
    expect(second.status).toBe(304);
  });
});

describe("queries on real SQL", () => {
  it("timeseries: month vs previous month with projection", async () => {
    const response = await request(app)
      .post("/api/query/timeseries")
      .send({
        metric: "trips",
        granularity: "month",
        filters,
        comparison: { mode: "previous_period" },
        includeProjection: true,
      });
    const body = timeseriesResponseSchema.parse(response.body);
    expect(body.series[0]?.points).toEqual({
      t: ["2026-09-01"],
      v: [tripsIn(SEPTEMBER)],
    });
    expect(body.comparison?.totals.comparison).toBe(tripsIn(AUGUST));
    expect(body.comparison?.totals.deltaPct).toBeCloseTo(
      (100 * (tripsIn(SEPTEMBER) - tripsIn(AUGUST))) / tripsIn(AUGUST),
      9,
    );
    expect(body.projection?.series[0]?.points.v[0]).toBeGreaterThan(0);
  });

  it("timeseries: hourly from trip_hourly, grouped by company", async () => {
    const response = await request(app)
      .post("/api/query/timeseries")
      .send({
        metric: "trips",
        granularity: "hour",
        filters: {
          ...filters,
          period: { from: "2026-09-01", to: "2026-09-01" },
        },
        comparison: { mode: "none" },
        groupBy: "company",
        includeProjection: false,
      });
    const body = timeseriesResponseSchema.parse(response.body);
    expect(body.series.map((s) => s.key)).toEqual(["yellow"]);
    expect(body.series[0]?.points.v.slice(0, 3)).toEqual([10, 11, 12]);
  });

  it("kpi: wait time restricted to FHVHV and compared with August", async () => {
    const response = await request(app)
      .post("/api/query/kpi")
      .send({
        metric: "avg_wait",
        filters,
        comparison: { mode: "previous_period" },
        evaluation: {
          comparison: { enabled: true, neutralBandPct: 2 },
          target: null,
        },
        sparkline: true,
      });
    const body = kpiResponseSchema.parse(response.body);
    const uber = sum(SEPTEMBER, "uber");
    const lyft = sum(SEPTEMBER, "lyft");
    expect(body.value).toBeCloseTo(
      (uber * 300 + lyft * 360) / (uber + lyft),
      9,
    );
    expect(body.sparkline?.t).toHaveLength(30);
  });

  it("breakdown: zones and routes labeled with the zones table", async () => {
    const zones = breakdownResponseSchema.parse(
      (
        await request(app)
          .post("/api/query/breakdown")
          .send({
            metric: "trips",
            dimensions: ["zone"],
            filters,
            comparison: { mode: "none" },
            sort: "desc",
          })
      ).body,
    );
    expect(zones.rows.map((r) => [r.labels[0], r.value])).toEqual([
      ["JFK Airport", sum(SEPTEMBER, "uber") + sum(SEPTEMBER, "lyft")],
      ["Midtown Center", sum(SEPTEMBER, "yellow")],
    ]);
    const routes = breakdownResponseSchema.parse(
      (
        await request(app)
          .post("/api/query/breakdown")
          .send({
            metric: "trips",
            dimensions: ["route"],
            filters,
            comparison: { mode: "previous_period" },
            sort: "desc",
          })
      ).body,
    );
    expect(routes.rows[0]).toMatchObject({
      labels: ["JFK Airport → Midtown Center"],
      value: 200,
      deltaPct: 0,
    });
  });

  it("map: zones, flows and sample points", async () => {
    const points = mapResponseSchema.parse(
      (
        await request(app)
          .post("/api/query/map")
          .send({ mode: "points", filters, colorBy: "service" })
      ).body,
    );
    expect(points.mode === "points" && points.columns.lon.length).toBe(19); // one sample row has no position
    const flows = mapResponseSchema.parse(
      (
        await request(app)
          .post("/api/query/map")
          .send({ mode: "flows", metric: "trips", filters, limit: 10 })
      ).body,
    );
    expect(flows.mode === "flows" && flows.columns.from).toEqual([132, 161]);
  });

  it("trips: all sample points, wait only for FHVHV", async () => {
    const all = tripsResponseSchema.parse(
      (
        await request(app)
          .post("/api/query/trips")
          .send({ x: "distance", y: "fare", colorBy: "service", filters })
      ).body,
    );
    expect(all.columns.x).toHaveLength(20);
    const wait = tripsResponseSchema.parse(
      (
        await request(app)
          .post("/api/query/trips")
          .send({ x: "wait", y: "fare", colorBy: "company", filters })
      ).body,
    );
    expect(wait.categories).toEqual(["uber"]);
    expect(wait.columns.x).toHaveLength(10);
  });
});
