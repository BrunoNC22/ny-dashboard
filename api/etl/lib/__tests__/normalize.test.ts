import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Duck } from "../duckdb";
import { type EtlStep, processSource } from "../pipeline";
import { NORMALIZED_COLUMNS } from "../sources";
import { fhvhvRow, writeParquet as write, yellowRow } from "./fixtures";

/**
 * Fixture parquet files are generated with DuckDB using the official column names and types
 * (see the schemas in api/etl/README.md), one row per normalization/cleaning case.
 */
let dir: string;
let duck: Duck;

const writeParquet = (name: string, select: string): Promise<string> =>
  write(duck, dir, name, [select]);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "etl-normalize-"));
  duck = await Duck.open();
});
afterAll(async () => {
  duck.close();
  await rm(dir, { recursive: true, force: true });
});

const trips = () =>
  duck.all<Record<string, unknown>>("SELECT * FROM trips ORDER BY pickup_at");

describe("yellow normalization and cleaning", () => {
  it("normalizes kept trips and counts every discard reason", async () => {
    const path = await writeParquet(
      "yellow_tripdata_2026-09.parquet",
      [
        // kept: card trip to JFK
        yellowRow(1, "2026-09-01 10:00:00", "2026-09-01 10:30:00", {
          pax: 2,
          dist: 10,
          dropZone: 132,
          fare: 40,
          tip: 8,
          total: 60,
        }),
        // kept: flex fare without passengers (passenger_count 0 → NULL)
        yellowRow(2, "2026-09-02 10:00:00", "2026-09-02 10:10:00", {
          pax: 0,
          pay: 0,
        }),
        // kept: cash, unknown pickup zone 264
        yellowRow(3, "2026-09-03 10:00:00", "2026-09-03 10:10:00", {
          pay: 2,
          pu: 264,
        }),
        yellowRow(4, "2026-08-31 23:50:00", "2026-09-01 00:10:00"), // outside_month
        yellowRow(5, "2026-09-04 10:00:00", "2026-09-04 10:10:00", {
          fare: -5,
        }), // negative_fare
        yellowRow(6, "2026-09-04 11:00:00", "2026-09-04 11:01:00", {
          fare: 9999.7,
        }), // fare_over_limit
        yellowRow(7, "2026-09-04 12:00:00", "2026-09-04 12:10:00", { dist: 0 }), // non_positive_distance
        yellowRow(8, "2026-09-04 13:00:00", "2026-09-04 13:00:00"), // invalid_duration (0 s)
        yellowRow(9, "2026-09-04 14:00:00", "2026-09-04 18:00:00"), // invalid_duration (> 3 h)
        yellowRow(10, "2026-09-04 15:00:00", "2026-09-04 15:01:00", {
          dist: 232644.8,
        }), // speed_over_limit
        yellowRow(11, "2026-09-04 16:00:00", "2026-09-04 16:10:00", { pu: 0 }), // invalid_pickup_zone
      ].join(" UNION ALL "),
    );

    const report = await processSource(duck, "yellow", "2026-09", path);
    expect(report).toEqual({
      month: "2026-09",
      service: "yellow",
      read: 11,
      kept: 3,
      discarded: {
        invalid_pickup_zone: 1,
        outside_month: 1,
        negative_fare: 1,
        fare_over_limit: 1,
        non_positive_distance: 1,
        invalid_duration: 2,
        speed_over_limit: 1,
      },
    });

    const rows = await trips();
    expect(Object.keys(rows[0] ?? {})).toEqual([...NORMALIZED_COLUMNS]);
    expect(rows[0]).toMatchObject({
      service: "yellow",
      company: "yellow",
      pu_zone_id: 161,
      do_zone_id: 132,
      passengers: 2,
      revenue: 60,
      fare: 40,
      tips: 8,
      distance_mi: 10,
      duration_s: 1800,
      is_airport: true,
      payment: "card",
      cbd_fee: 0.75,
      wait_s: null,
      driver_pay: null,
      is_shared: null,
    });
    expect(rows[1]).toMatchObject({
      passengers: null,
      payment: "flex",
      is_airport: false,
    });
    expect(rows[2]).toMatchObject({ pu_zone_id: 264, payment: "cash" });
  });
});

describe("green normalization", () => {
  it("uses lpep columns and treats a missing CBD fee column (before 2025) as zero", async () => {
    const path = await writeParquet(
      "green_tripdata_2024-10.parquet",
      `SELECT TIMESTAMP '2024-10-05 08:00:00' AS lpep_pickup_datetime,
              TIMESTAMP '2024-10-05 08:20:00' AS lpep_dropoff_datetime,
              NULL::BIGINT AS passenger_count, 3.5::DOUBLE AS trip_distance,
              74::INTEGER AS PULocationID, 1::INTEGER AS DOLocationID, NULL::BIGINT AS payment_type,
              18::DOUBLE AS fare_amount, 0::DOUBLE AS tip_amount, 22.5::DOUBLE AS total_amount`,
    );
    const report = await processSource(duck, "green", "2024-10", path);
    expect(report.kept).toBe(1);
    expect((await trips())[0]).toMatchObject({
      service: "green",
      company: "green",
      passengers: null,
      payment: "other",
      cbd_fee: 0,
      is_airport: true, // dropoff at EWR (zone 1)
      duration_s: 1200,
    });
  });
});

describe("fhvhv normalization", () => {
  it("maps companies, sums the passenger total and computes wait time", async () => {
    const path = await writeParquet(
      "fhvhv_tripdata_2026-09.parquet",
      [
        fhvhvRow("HV0003", "2026-09-10 09:55:00", "2026-09-10 10:00:00", {
          shared: "Y",
        }),
        fhvhvRow("HV0005", null, "2026-09-10 11:00:00", { airportFee: "NULL" }),
        fhvhvRow("HV0004", "2026-09-10 12:05:00", "2026-09-10 12:00:00"), // request after pickup → no wait
      ].join(" UNION ALL "),
    );
    const report = await processSource(duck, "fhvhv", "2026-09", path);
    expect(report.kept).toBe(3);

    const [uber, lyft, other] = await trips();
    expect(uber).toMatchObject({
      company: "uber",
      passengers: null,
      payment: null,
      revenue: 20 + 1 + 0.5 + 1.8 + 2.75 + 2.5 + 3 + 1.5,
      fare: 20,
      tips: 3,
      distance_mi: 5.2,
      duration_s: 900,
      wait_s: 300,
      driver_pay: 16,
      is_shared: true,
      is_airport: true,
      cbd_fee: 1.5,
    });
    expect(lyft).toMatchObject({
      company: "lyft",
      wait_s: null,
      is_shared: false,
    });
    expect(lyft?.revenue).toBeCloseTo(20 + 1 + 0.5 + 1.8 + 2.75 + 3 + 1.5); // NULL airport fee → 0
    expect(other).toMatchObject({ company: "other", wait_s: null });
  });

  it("works without the CBD fee column and runs the steps", async () => {
    const path = await writeParquet(
      "fhvhv_tripdata_2024-10.parquet",
      fhvhvRow("HV0003", "2024-10-10 09:55:00", "2024-10-10 10:00:00", {
        cbd: false,
      }),
    );
    const run = vi.fn(() => Promise.resolve());
    const step: EtlStep = { name: "spy", run };
    await processSource(duck, "fhvhv", "2024-10", path, [step]);
    expect((await trips())[0]).toMatchObject({ cbd_fee: 0 });
    expect(run).toHaveBeenCalledWith({
      duck,
      month: "2024-10",
      service: "fhvhv",
    });
  });
});
