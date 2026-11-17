import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createTripSampleStep, loadZones } from "../../steps/tripSample";
import { Duck } from "../duckdb";
import { pointInGeometry } from "../geo";
import { ZONES_DIR } from "../paths";
import { processSource } from "../pipeline";
import { computeQuotas } from "../sample";
import { ensureStore, saveSourceReport } from "../store";
import { fhvhvRow, greenRow, writeParquet, yellowRow } from "./fixtures";

describe("computeQuotas", () => {
  it("takes everything when there are fewer rows than the sample size", () => {
    expect(computeQuotas({ yellow: 10, green: 5 }, 100, 50)).toEqual({
      yellow: 10,
      green: 5,
    });
  });

  it("guarantees the floor and splits the rest proportionally (September 2026 volumes)", () => {
    const quotas = computeQuotas(
      { yellow: 3_666_941, green: 44_152, fhvhv: 20_981_078 },
      1_000_000,
      50_000,
    );
    expect(quotas.green).toBe(44_152); // fewer than the floor → all of them
    expect(quotas.yellow).toBeGreaterThan(50_000);
    expect(
      (quotas.yellow ?? 0) + (quotas.green ?? 0) + (quotas.fhvhv ?? 0),
    ).toBe(1_000_000);
    // remaining 855,848 rows split by remaining availability → yellow ≈ 176k, fhvhv ≈ 780k
    expect(quotas.yellow).toBeCloseTo(176_101, -2);
    expect(quotas.fhvhv).toBeCloseTo(779_747, -2);
  });
});

let dir: string;
let duck: Duck;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "etl-sample-"));
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

const minute = (i: number) => String(i % 60).padStart(2, "0");

const runSample = async (size: number, floorPerService: number) => {
  const log = vi.fn();
  const step = createTripSampleStep({
    month: "2026-09",
    size,
    floorPerService,
    log,
  });
  const sources = {
    yellow: Array.from({ length: 30 }, (_, i) =>
      yellowRow(1, `2026-09-01 10:${minute(i)}:00`, "2026-09-01 11:30:00", {
        pu: i % 2 ? 161 : 264,
      }),
    ),
    green: Array.from({ length: 3 }, (_, i) =>
      greenRow(`2026-09-02 08:${minute(i)}:00`, "2026-09-02 08:50:00"),
    ),
    fhvhv: Array.from({ length: 60 }, (_, i) =>
      fhvhvRow(
        i % 2 ? "HV0003" : "HV0005",
        null,
        `2026-09-03 09:${minute(i)}:00`,
        { pu: 132 },
      ),
    ),
  };
  for (const [service, rows] of Object.entries(sources) as [
    keyof typeof sources,
    string[],
  ][]) {
    const path = await writeParquet(
      duck,
      dir,
      `${service}_tripdata_2026-09.parquet`,
      rows,
    );
    const report = await processSource(duck, service, "2026-09", path, [step]);
    await saveSourceReport(duck, report);
  }
  await step.finalize?.(duck);
  return log;
};

describe("trip sample", () => {
  it("allocates quotas per service and positions trips inside their pickup zone", async () => {
    const log = await runSample(20, 5);
    const counts = await duck.all(
      "SELECT service, count(*) AS n FROM trip_sample GROUP BY ALL ORDER BY ALL",
    );
    // floors: green 3 (all), yellow 5, fhvhv 5; remaining 7 split ~1:2 between yellow (25) and fhvhv (55)
    expect(counts).toEqual([
      { service: "fhvhv", n: 10 },
      { service: "green", n: 3 },
      { service: "yellow", n: 7 },
    ]);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("sample     fhvhv 10, green 3, yellow 7"),
    );

    const zones = await loadZones(join(ZONES_DIR, "taxi_zones.geojson"));
    const rows = await duck.all<{
      pu_zone_id: number;
      lon: number | null;
      lat: number | null;
    }>("SELECT pu_zone_id, lon, lat FROM trip_sample");
    for (const row of rows) {
      const zone = zones.get(row.pu_zone_id);
      if (!zone) {
        expect(row.pu_zone_id).toBe(264); // no geometry → no position
        expect(row.lon).toBeNull();
        continue;
      }
      expect(pointInGeometry(zone.geometry, [row.lon ?? 0, row.lat ?? 0])).toBe(
        true,
      );
    }
    const ids = await duck.all<{ ok: boolean }>(
      "SELECT count(DISTINCT sample_id) = count(*) AND min(sample_id) = 1 AND max(sample_id) = count(*) AS ok FROM trip_sample",
    );
    expect(ids[0]?.ok).toBe(true);
  });

  it("is reproducible across runs", async () => {
    await runSample(20, 5);
    const first = await duck.all(
      "SELECT * FROM trip_sample ORDER BY sample_id",
    );
    await runSample(20, 5);
    expect(
      await duck.all("SELECT * FROM trip_sample ORDER BY sample_id"),
    ).toEqual(first);
  });

  it("skips when the sample month was not processed", async () => {
    const log = vi.fn();
    await createTripSampleStep({ month: "2026-09", log }).finalize?.(duck);
    expect(log).toHaveBeenCalledWith(
      "sample     skipped (month 2026-09 not processed yet)",
    );
  });
});
