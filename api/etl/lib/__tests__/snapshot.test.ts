import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dailyZoneStep } from "../../steps/dailyZone";
import { hourlyStep } from "../../steps/hourly";
import { odMonthlyStep } from "../../steps/odMonthly";
import { createTripSampleStep } from "../../steps/tripSample";
import { Duck } from "../duckdb";
import { addMonths } from "../months";
import { processSource } from "../pipeline";
import { defaultPeriod, exportSnapshot, type Manifest } from "../snapshot";
import { ensureStore, saveSourceReport } from "../store";
import { fhvhvRow, greenRow, writeParquet, yellowRow } from "./fixtures";

let dir: string;
let duck: Duck;
const quiet = () => undefined;
const period = { from: "2026-08", to: "2026-09" } as const;

const minute = (i: number) => String(i % 60).padStart(2, "0");

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "etl-snapshot-"));
  duck = await Duck.open();
  await ensureStore(duck);
  const steps = [
    dailyZoneStep,
    hourlyStep,
    odMonthlyStep,
    createTripSampleStep({
      month: "2026-09",
      size: 50,
      floorPerService: 5,
      log: quiet,
    }),
  ];
  for (const month of ["2026-07", "2026-08", "2026-09"] as const) {
    const sources = {
      yellow: Array.from({ length: 40 }, (_, i) =>
        yellowRow(
          1,
          `${month}-0${String((i % 9) + 1)} 1${String(i % 10)}:${minute(i)}:00`,
          `${month}-0${String((i % 9) + 1)} 1${String(i % 10)}:59:00`,
          {
            pu: [161, 48, 132, 230][i % 4],
            dropZone: [236, 161, 138][i % 3],
            pay: i % 3,
          },
        ),
      ),
      green: [greenRow(`${month}-02 08:00:00`, `${month}-02 08:30:00`)],
      fhvhv: Array.from({ length: 30 }, (_, i) =>
        fhvhvRow(
          i % 2 ? "HV0003" : "HV0005",
          null,
          `${month}-1${String(i % 9)} 09:${minute(i)}:00`,
          { pu: 79 },
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
        `${service}_tripdata_${month}.parquet`,
        rows,
      );
      await saveSourceReport(
        duck,
        await processSource(duck, service, month, path, steps),
      );
    }
  }
  for (const step of steps) await step.finalize?.(duck);
});
afterAll(async () => {
  duck.close();
  await rm(dir, { recursive: true, force: true });
});

const readManifest = async (out: string) =>
  JSON.parse(await readFile(join(out, "manifest.json"), "utf8")) as Manifest;

const readCsv = async (out: string, files: { file: string }[]) =>
  await Promise.all(
    files.map(async ({ file }) =>
      gunzipSync(await readFile(join(out, file))).toString("utf8"),
    ),
  );

describe("snapshot export", () => {
  it("defaults to the most recent months of the store", async () => {
    expect(await defaultPeriod(duck, 2)).toEqual(period);
    expect(addMonths("2026-09", -23)).toBe("2024-10");
  });

  it("writes gzip CSV files with checksums and a manifest restricted to the period", async () => {
    const out = join(dir, "out");
    await exportSnapshot(duck, { dir: out, period, log: quiet });
    const manifest = await readManifest(out);

    expect(manifest).toMatchObject({
      formatVersion: 1,
      period,
      sampleMonth: "2026-09",
    });
    expect(manifest.sources.map((s) => `${s.month} ${s.service}`)).toEqual([
      "2026-08 fhvhv",
      "2026-08 green",
      "2026-08 yellow",
      "2026-09 fhvhv",
      "2026-09 green",
      "2026-09 yellow",
    ]);
    expect(Object.keys(manifest.tables)).toEqual([
      "agg_daily_zone",
      "agg_hourly",
      "agg_od_monthly",
      "trip_sample",
    ]);

    for (const table of Object.values(manifest.tables)) {
      for (const file of table.files) {
        const content = await readFile(join(out, file.file));
        expect(createHash("sha256").update(content).digest("hex")).toBe(
          file.sha256,
        );
        expect(content.length).toBe(file.bytes);
      }
    }

    const [daily] = await readCsv(
      out,
      manifest.tables.agg_daily_zone?.files ?? [],
    );
    const lines = (daily ?? "").trim().split("\n");
    expect(lines[0]).toBe(
      manifest.tables.agg_daily_zone?.columns.map((c) => c.name).join(","),
    );
    expect(lines.slice(1).every((line) => /^2026-0[89]-/.test(line))).toBe(
      true,
    ); // July excluded
    expect(lines).toHaveLength((manifest.tables.agg_daily_zone?.rows ?? 0) + 1);
    expect(manifest.tables.trip_sample?.rows).toBe(50);
  });

  it("is deterministic", async () => {
    const a = join(dir, "a");
    const b = join(dir, "b");
    await exportSnapshot(duck, { dir: a, period, log: quiet });
    await exportSnapshot(duck, { dir: b, period, log: quiet });
    const files = (m: Manifest) =>
      Object.values(m.tables).flatMap((t) => t.files.map((f) => f.sha256));
    expect(files(await readManifest(b))).toEqual(files(await readManifest(a)));
  });

  it("splits large tables into chunks without losing or reordering rows", async () => {
    const single = join(dir, "single");
    await exportSnapshot(duck, { dir: single, period, log: quiet });
    const one = await readManifest(single);
    const size = one.tables.agg_daily_zone?.files[0]?.bytes ?? 0;

    const split = join(dir, "split");
    await exportSnapshot(duck, {
      dir: split,
      period,
      log: quiet,
      maxChunkBytes: size - 1,
      targetChunkBytes: Math.floor(size / 3),
    });
    const many = await readManifest(split);
    const files = many.tables.agg_daily_zone?.files ?? [];
    expect(files.length).toBeGreaterThan(1);
    expect(files.every((file) => file.bytes <= size - 1)).toBe(true);

    const rowsOf = (csv: string[]) =>
      csv.flatMap((c) => c.trim().split("\n").slice(1));
    expect(rowsOf(await readCsv(split, files))).toEqual(
      rowsOf(await readCsv(single, one.tables.agg_daily_zone?.files ?? [])),
    );
  });

  it("refuses to export a period with missing months", async () => {
    await expect(
      exportSnapshot(duck, {
        dir: join(dir, "x"),
        period: { from: "2026-05", to: "2026-09" },
        log: quiet,
      }),
    ).rejects.toThrow("Months missing from the ETL store: 2026-05, 2026-06");
  });
});
