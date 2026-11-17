import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { dailyZoneStep } from "../../steps/dailyZone";
import { hourlyStep } from "../../steps/hourly";
import { Duck } from "../duckdb";
import { METRIC_COLUMN_NAMES } from "../metrics";
import { processSource } from "../pipeline";
import { ensureStore } from "../store";
import { fhvhvRow, writeParquet, yellowRow } from "./fixtures";

let dir: string;
let duck: Duck;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "etl-hourly-"));
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

const steps = [dailyZoneStep, hourlyStep];

describe("metric columns", () => {
  it("lists the base metric columns in table order", () => {
    expect(METRIC_COLUMN_NAMES[0]).toBe("trips");
    expect(METRIC_COLUMN_NAMES).toContain("shared_trips");
    expect(METRIC_COLUMN_NAMES).toHaveLength(16);
  });
});

describe("agg_hourly", () => {
  it("aggregates per wall-clock hour, service and company", async () => {
    const path = await writeParquet(
      duck,
      dir,
      "fhvhv_tripdata_2026-09.parquet",
      [
        fhvhvRow("HV0003", "2026-09-10 09:55:00", "2026-09-10 10:00:00"),
        fhvhvRow("HV0003", "2026-09-10 10:58:00", "2026-09-10 10:59:59"),
        fhvhvRow("HV0003", "2026-09-10 10:59:00", "2026-09-10 11:00:00"),
        fhvhvRow("HV0005", "2026-09-10 10:20:00", "2026-09-10 10:30:00"),
      ],
    );
    await processSource(duck, "fhvhv", "2026-09", path, steps);
    const rows = await duck.all(
      "SELECT strftime(hour, '%Y-%m-%d %H:%M') AS hour, company, trips, wait_s FROM agg_hourly ORDER BY ALL",
    );
    expect(rows).toEqual([
      { hour: "2026-09-10 10:00", company: "lyft", trips: 1, wait_s: 600 },
      {
        hour: "2026-09-10 10:00",
        company: "uber",
        trips: 2,
        wait_s: 300 + 119,
      },
      { hour: "2026-09-10 11:00", company: "uber", trips: 1, wait_s: 60 },
    ]);
  });

  it("is consistent with the daily aggregate (sum of hours = day) for every metric", async () => {
    const yellow = await writeParquet(
      duck,
      dir,
      "yellow_tripdata_2026-09.parquet",
      [
        yellowRow(1, "2026-09-01 00:05:00", "2026-09-01 00:25:00", {
          pax: 2,
          pay: 2,
        }),
        yellowRow(1, "2026-09-01 08:00:00", "2026-09-01 08:30:00", {
          dropZone: 132,
          pu: 48,
        }),
        yellowRow(1, "2026-09-01 23:59:00", "2026-09-02 00:15:00", {
          pax: 0,
          pay: 0,
        }),
        yellowRow(1, "2026-09-02 12:00:00", "2026-09-02 12:10:00", { pu: 230 }),
      ],
    );
    const fhvhv = await writeParquet(
      duck,
      dir,
      "fhvhv_tripdata_2026-09.parquet",
      [
        fhvhvRow("HV0003", "2026-09-01 07:55:00", "2026-09-01 08:00:00", {
          shared: "Y",
        }),
        fhvhvRow("HV0005", null, "2026-09-01 18:00:00", { pu: 132 }),
      ],
    );
    await processSource(duck, "yellow", "2026-09", yellow, steps);
    await processSource(duck, "fhvhv", "2026-09", fhvhv, steps);

    const sums = METRIC_COLUMN_NAMES.map((col) => `sum(${col}) AS ${col}`).join(
      ", ",
    );
    const fromDaily = await duck.all(
      `SELECT service, company, strftime(date, '%Y-%m-%d') AS day, ${sums} FROM agg_daily_zone GROUP BY ALL ORDER BY ALL`,
    );
    const fromHourly = await duck.all(
      `SELECT service, company, strftime(hour, '%Y-%m-%d') AS day, ${sums} FROM agg_hourly GROUP BY ALL ORDER BY ALL`,
    );
    expect(fromHourly).toEqual(fromDaily);
    expect(fromDaily).toHaveLength(4); // yellow 09-01, yellow 09-02, uber, lyft
  });
});
