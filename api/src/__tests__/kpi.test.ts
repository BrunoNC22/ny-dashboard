import { type KpiRequest, kpiResponseSchema } from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  evaluateKpi,
  statusFromChange,
  statusFromTarget,
  worstStatus,
} from "../lib/kpiStatus";
import { createKpiService, sparklineGranularity } from "../services/kpiService";
import { createTestApp } from "./helpers";
import {
  createMemoryQueryRepository,
  type DailyFixture,
} from "./memoryQueries";

describe("status rules", () => {
  it("comparison: improvement beyond the band is good, worsening is bad, else warning", () => {
    expect(statusFromChange(5, "higher_is_better", 2)).toBe("good");
    expect(statusFromChange(-5, "higher_is_better", 2)).toBe("bad");
    expect(statusFromChange(1, "higher_is_better", 2)).toBe("warning");
    expect(statusFromChange(-5, "lower_is_better", 2)).toBe("good"); // e.g. wait time fell
    expect(statusFromChange(null, "higher_is_better", 2)).toBe("neutral");
  });

  it("target: reached is good, within the band is warning, beyond is bad", () => {
    expect(statusFromTarget(900, 900, "higher_is_better", 5)).toBe("good");
    expect(statusFromTarget(870, 900, "higher_is_better", 5)).toBe("warning");
    expect(statusFromTarget(800, 900, "higher_is_better", 5)).toBe("bad");
    expect(statusFromTarget(290, 300, "lower_is_better", 10)).toBe("good");
    expect(statusFromTarget(325, 300, "lower_is_better", 10)).toBe("warning");
    expect(statusFromTarget(342, 300, "lower_is_better", 10)).toBe("bad");
  });

  it("combines the rules taking the worst, neutral without rules", () => {
    expect(worstStatus(["good", "warning"])).toBe("warning");
    expect(worstStatus([])).toBe("neutral");
    const both = {
      comparison: { enabled: true, neutralBandPct: 2 },
      target: { value: 900, warningBandPct: 5 },
    };
    expect(evaluateKpi(870, 10, both, "higher_is_better")).toBe("warning");
    expect(
      evaluateKpi(
        870,
        10,
        { comparison: { enabled: false, neutralBandPct: 2 }, target: null },
        "higher_is_better",
      ),
    ).toBe("neutral");
    // per-KPI direction override
    expect(
      evaluateKpi(
        100,
        10,
        {
          direction: "lower_is_better",
          comparison: { enabled: true, neutralBandPct: 2 },
          target: null,
        },
        "higher_is_better",
      ),
    ).toBe("bad");
  });
});

const day = (date: string, trips: number, wait?: number): DailyFixture => ({
  date,
  service: "fhvhv",
  company: "uber",
  zone: 132,
  sums: {
    trips,
    fare: trips * 20,
    ...(wait === undefined ? {} : { wait_s: wait * trips, wait_trips: trips }),
  },
});

const daily: DailyFixture[] = [
  day("2026-08-10", 1000, 300),
  day("2026-09-01", 600, 360),
  day("2026-09-02", 500, 330),
  {
    date: "2026-09-01",
    service: "yellow",
    company: "yellow",
    zone: 161,
    sums: { trips: 100, fare: 1500 },
  },
];
const projection = [
  {
    date: "2026-09-01",
    service: "fhvhv" as const,
    borough: "queens" as const,
    sums: { trips: 1000, fare: 20000 },
  },
  {
    date: "2026-09-01",
    service: "yellow" as const,
    borough: "manhattan" as const,
    sums: { trips: 100, fare: 1500 },
  },
];
const service = createKpiService(
  createMemoryQueryRepository({ daily, projection }),
);

const base: KpiRequest = {
  metric: "trips",
  filters: {
    period: { from: "2026-09-01", to: "2026-09-30" },
    services: [],
    companies: [],
    boroughs: [],
    zones: [],
  },
  comparison: { mode: "previous_period" },
  evaluation: {
    comparison: { enabled: true, neutralBandPct: 2 },
    target: null,
  },
  sparkline: true,
};

describe("kpi service", () => {
  it("returns value, comparison, status and sparkline", async () => {
    const response = await service.query(base);
    expect(response).toMatchObject({
      value: 1200,
      comparison: {
        range: { from: "2026-08-01", to: "2026-08-31" },
        value: 1000,
        deltaAbs: 200,
        deltaPct: 20,
      },
      status: "good",
      target: null,
    });
    expect(response.sparkline?.t).toHaveLength(30);
    expect(response.sparkline?.v.slice(0, 3)).toEqual([700, 500, null]);
  });

  it("uses the metric direction: a longer wait is bad", async () => {
    const response = await service.query({ ...base, metric: "avg_wait" });
    // (600×360 + 500×330) / 1100 ≈ 346.4 s vs 300 s
    expect(response.value).toBeCloseTo(346.36, 1);
    expect(response.status).toBe("bad");
  });

  it("evaluates a target", async () => {
    const response = await service.query({
      ...base,
      comparison: { mode: "none" },
      evaluation: {
        comparison: { enabled: false, neutralBandPct: 2 },
        target: { value: 1250, warningBandPct: 5 },
      },
    });
    expect(response).toMatchObject({
      value: 1200,
      comparison: null,
      target: 1250,
      status: "warning",
    });
  });

  it("compares with the projection when possible", async () => {
    const response = await service.query({
      ...base,
      comparison: { mode: "projection" },
    });
    expect(response.comparison).toMatchObject({ value: 1100, deltaAbs: 100 });
    const filtered = await service.query({
      ...base,
      comparison: { mode: "projection" },
      filters: { ...base.filters, companies: ["uber"] },
    });
    expect(filtered.comparison).toBeNull();
    expect(filtered.status).toBe("neutral");
  });

  it("is not applicable when no selected service has the metric", async () => {
    const response = await service.query({
      ...base,
      metric: "card_pct",
      filters: { ...base.filters, services: ["fhvhv"] },
    });
    expect(response).toMatchObject({
      notApplicable: true,
      value: null,
      status: "neutral",
    });
  });

  it("uses daily sparklines up to ~4 months and weekly beyond", () => {
    expect(sparklineGranularity({ from: "2026-06-01", to: "2026-09-30" })).toBe(
      "day",
    );
    expect(sparklineGranularity({ from: "2025-10-01", to: "2026-09-30" })).toBe(
      "week",
    );
  });
});

describe("POST /api/query/kpi", () => {
  it("returns a schema-valid response", async () => {
    const memory = createTestApp();
    const { app } = createTestApp({
      repositories: {
        ...memory.deps.repositories,
        queries: createMemoryQueryRepository({ daily, projection }),
      },
    });
    const response = await request(app).post("/api/query/kpi").send(base);
    expect(response.status).toBe(200);
    expect(kpiResponseSchema.parse(response.body).status).toBe("good");
  });
});
