import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { dailyZoneStep } from "../../steps/dailyZone";
import { Duck } from "../duckdb";
import { processSource } from "../pipeline";
import { ensureStore, saveSourceReport, STORE_SCHEMA_VERSION } from "../store";
import { fhvhvRow, writeParquet, yellowRow } from "./fixtures";

let dir: string;
let duck: Duck;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "etl-daily-"));
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

const daily = () =>
  duck.all<Record<string, unknown>>(
    "SELECT * EXCLUDE (date), strftime(date, '%Y-%m-%d') AS day FROM agg_daily_zone ORDER BY service, day, company, pu_zone_id",
  );

const yellowSeptember = () =>
  writeParquet(duck, dir, "yellow_tripdata_2026-09.parquet", [
    yellowRow(1, "2026-09-01 10:00:00", "2026-09-01 10:30:00", {
      pax: 2,
      dist: 10,
      dropZone: 132,
      fare: 40,
      tip: 8,
      total: 60,
    }),
    yellowRow(1, "2026-09-01 11:00:00", "2026-09-01 11:10:00", {
      pax: 0,
      pay: 0,
    }),
    yellowRow(1, "2026-09-01 23:30:00", "2026-09-01 23:40:00", { pay: 2 }),
    yellowRow(1, "2026-09-02 00:10:00", "2026-09-02 00:20:00"),
    yellowRow(1, "2026-09-01 12:00:00", "2026-09-01 12:10:00", { pu: 48 }),
    yellowRow(1, "2026-09-01 13:00:00", "2026-09-01 13:10:00", { fare: -5 }), // discarded
  ]);

describe("agg_daily_zone", () => {
  it("aggregates kept yellow trips per New York day and pickup zone", async () => {
    const report = await processSource(
      duck,
      "yellow",
      "2026-09",
      await yellowSeptember(),
      [dailyZoneStep],
    );
    const rows = await daily();

    expect(rows.reduce((sum, row) => sum + Number(row.trips), 0)).toBe(
      report.kept,
    );
    expect(rows.map((row) => [row.day, row.pu_zone_id, row.trips])).toEqual([
      ["2026-09-01", 48, 1],
      ["2026-09-01", 161, 3],
      ["2026-09-02", 161, 1],
    ]);
    expect(rows[1]).toMatchObject({
      service: "yellow",
      company: "yellow",
      passengers: 3, // 2 + 1; passenger_count 0 is unknown
      passenger_trips: 2,
      revenue: 90,
      fare: 60,
      tips: 12,
      distance_mi: 14,
      duration_s: 1800 + 600 + 600,
      airport_trips: 1,
      card_trips: 1,
      cash_trips: 1,
      cbd_fee: 2.25,
      wait_s: null,
      wait_trips: null,
      driver_pay: null,
      shared_trips: null,
    });
  });

  it("splits FHVHV by company and fills FHVHV-only columns", async () => {
    const path = await writeParquet(
      duck,
      dir,
      "fhvhv_tripdata_2026-09.parquet",
      [
        fhvhvRow("HV0003", "2026-09-10 09:55:00", "2026-09-10 10:00:00", {
          shared: "Y",
        }),
        fhvhvRow("HV0003", null, "2026-09-10 11:00:00"),
        fhvhvRow("HV0005", "2026-09-10 11:58:00", "2026-09-10 12:00:00"),
      ],
    );
    await processSource(duck, "fhvhv", "2026-09", path, [dailyZoneStep]);
    const [lyft, uber] = await daily();

    expect(uber).toMatchObject({
      company: "uber",
      trips: 2,
      passengers: null,
      passenger_trips: null,
      card_trips: null,
      cash_trips: null,
      wait_s: 300,
      wait_trips: 1, // the trip without request time does not count
      driver_pay: 32,
      shared_trips: 1,
      airport_trips: 2,
    });
    expect(lyft).toMatchObject({
      company: "lyft",
      trips: 1,
      wait_s: 120,
      shared_trips: 0,
    });
  });

  it("is idempotent and only replaces the processed month × service", async () => {
    const yellow = await yellowSeptember();
    const fhvhv = await writeParquet(
      duck,
      dir,
      "fhvhv_tripdata_2026-09.parquet",
      [fhvhvRow("HV0003", null, "2026-09-10 10:00:00")],
    );
    const august = await writeParquet(
      duck,
      dir,
      "yellow_tripdata_2026-08.parquet",
      [yellowRow(1, "2026-08-31 10:00:00", "2026-08-31 10:10:00")],
    );

    await processSource(duck, "yellow", "2026-08", august, [dailyZoneStep]);
    await processSource(duck, "fhvhv", "2026-09", fhvhv, [dailyZoneStep]);
    await processSource(duck, "yellow", "2026-09", yellow, [dailyZoneStep]);
    await processSource(duck, "yellow", "2026-09", yellow, [dailyZoneStep]); // re-run

    const totals = await duck.all<{
      service: string;
      month: string;
      trips: number;
    }>(
      "SELECT service, strftime(date, '%Y-%m') AS month, sum(trips)::BIGINT AS trips FROM agg_daily_zone GROUP BY ALL ORDER BY ALL",
    );
    expect(totals).toEqual([
      { service: "fhvhv", month: "2026-09", trips: 1 },
      { service: "yellow", month: "2026-08", trips: 1 },
      { service: "yellow", month: "2026-09", trips: 5 },
    ]);
  });
});

describe("store", () => {
  it("saves one report per month × service", async () => {
    const report = {
      month: "2026-09" as const,
      service: "green" as const,
      read: 10,
      kept: 9,
      discarded: {
        invalid_pickup_zone: 0,
        outside_month: 1,
        negative_fare: 0,
        fare_over_limit: 0,
        non_positive_distance: 0,
        invalid_duration: 0,
        speed_over_limit: 0,
      },
    };
    await saveSourceReport(duck, report);
    await saveSourceReport(duck, { ...report, kept: 8 });
    expect(
      await duck.all("SELECT month, service, read, kept FROM etl_sources"),
    ).toEqual([{ month: "2026-09", service: "green", read: 10, kept: 8 }]);
  });

  it("recreates the tables when the schema version changes", async () => {
    await duck.run(
      "INSERT INTO etl_sources VALUES ('2026-09', 'green', 1, 1, '{}', now()::TIMESTAMP)",
    );
    await duck.run(
      "UPDATE etl_meta SET value = '0' WHERE key = 'schema_version'",
    );
    await ensureStore(duck);
    expect(await duck.all("SELECT * FROM etl_sources")).toEqual([]);
    expect(await duck.all("SELECT value FROM etl_meta")).toEqual([
      { value: String(STORE_SCHEMA_VERSION) },
    ]);
  });
});
