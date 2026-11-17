import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createOdMonthlyStep } from "../../steps/odMonthly";
import { Duck } from "../duckdb";
import { processSource } from "../pipeline";
import { ensureStore } from "../store";
import { fhvhvRow, writeParquet, yellowRow } from "./fixtures";

let dir: string;
let duck: Duck;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "etl-od-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  duck = await Duck.open();
  await ensureStore(duck);
  return () => {
    duck.close();
  };
});

const routes = () =>
  duck.all(
    "SELECT strftime(month, '%Y-%m') AS month, company, pu_borough, pu_zone_id, do_zone_id, trips FROM agg_od_monthly ORDER BY company, pu_borough, trips DESC, pu_zone_id, do_zone_id",
  );

const trip = (pu: number, dropZone: number, minute: number) =>
  yellowRow(
    1,
    `2026-09-01 10:${String(minute).padStart(2, "0")}:00`,
    "2026-09-01 11:30:00",
    {
      pu,
      dropZone,
    },
  );

describe("agg_od_monthly", () => {
  it("keeps the top N routes per pickup borough and ignores invalid dropoffs", async () => {
    const path = await writeParquet(
      duck,
      dir,
      "yellow_tripdata_2026-09.parquet",
      [
        // Manhattan pickups (161, 162): 161→236 ×3, 162→236 ×2, 161→132 ×1 (cut with N = 2)
        trip(161, 236, 1),
        trip(161, 236, 2),
        trip(161, 236, 3),
        trip(162, 236, 4),
        trip(162, 236, 5),
        trip(161, 132, 6),
        // Queens pickup (132) is ranked separately, so it survives despite having 1 trip
        trip(132, 161, 7),
        // invalid dropoff zone → ignored
        trip(161, 0, 8),
      ],
    );
    const report = await processSource(duck, "yellow", "2026-09", path, [
      createOdMonthlyStep(2),
    ]);
    expect(report.kept).toBe(8);
    expect(await routes()).toEqual([
      {
        month: "2026-09",
        company: "yellow",
        pu_borough: "manhattan",
        pu_zone_id: 161,
        do_zone_id: 236,
        trips: 3,
      },
      {
        month: "2026-09",
        company: "yellow",
        pu_borough: "manhattan",
        pu_zone_id: 162,
        do_zone_id: 236,
        trips: 2,
      },
      {
        month: "2026-09",
        company: "yellow",
        pu_borough: "queens",
        pu_zone_id: 132,
        do_zone_id: 161,
        trips: 1,
      },
    ]);
  });

  it("ranks each company separately and sums revenue, distance and duration", async () => {
    const path = await writeParquet(
      duck,
      dir,
      "fhvhv_tripdata_2026-09.parquet",
      [
        fhvhvRow("HV0003", null, "2026-09-10 10:00:00", {
          pu: 264,
          dropZone: 1,
        }),
        fhvhvRow("HV0003", null, "2026-09-10 11:00:00", {
          pu: 264,
          dropZone: 1,
        }),
        fhvhvRow("HV0005", null, "2026-09-10 12:00:00", {
          pu: 264,
          dropZone: 1,
        }),
      ],
    );
    await processSource(duck, "fhvhv", "2026-09", path, [
      createOdMonthlyStep(1),
    ]);
    const rows = await duck.all(
      "SELECT company, pu_borough, trips, round(revenue, 2) AS revenue, distance_mi, duration_s FROM agg_od_monthly ORDER BY company",
    );
    expect(rows).toEqual([
      {
        company: "lyft",
        pu_borough: "unknown",
        trips: 1,
        revenue: 33.05,
        distance_mi: 5.2,
        duration_s: 900,
      },
      {
        company: "uber",
        pu_borough: "unknown",
        trips: 2,
        revenue: 66.1,
        distance_mi: 10.4,
        duration_s: 1800,
      },
    ]);
  });

  it("loads the zone → borough lookup from the versioned CSV", async () => {
    expect(
      await duck.all(
        "SELECT zone_id, borough FROM zones WHERE zone_id IN (1, 5, 132, 265) ORDER BY zone_id",
      ),
    ).toEqual([
      { zone_id: 1, borough: "ewr" },
      { zone_id: 5, borough: "staten_island" },
      { zone_id: 132, borough: "queens" },
      { zone_id: 265, borough: "unknown" },
    ]);
  });
});
