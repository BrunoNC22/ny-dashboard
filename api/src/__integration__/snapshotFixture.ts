import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { dateRange } from "../lib/periods";

/**
 * Small deterministic snapshot (Aug–Sep 2026) in the same format as api/data/snapshot, used by
 * the integration tests to exercise the real seed (COPY, checksums, projections).
 */

export const FIXTURE_PERIOD = { from: "2026-08-01", to: "2026-09-30" } as const;

/** Daily trips per source; September grows to make comparisons meaningful. */
export const dailyTrips = (
  date: string,
  source: "yellow" | "uber" | "lyft",
): number => {
  const day = Number(date.slice(8, 10));
  const september = date.startsWith("2026-09");
  switch (source) {
    case "yellow":
      return 100 + day + (september ? 20 : 0);
    case "uber":
      return 300 + (september ? 50 : 0);
    case "lyft":
      return 120;
  }
};

const DAILY_COLUMNS = [
  "date",
  "service",
  "company",
  "pu_zone_id",
  "trips",
  "passengers",
  "passenger_trips",
  "revenue",
  "fare",
  "tips",
  "distance_mi",
  "duration_s",
  "airport_trips",
  "card_trips",
  "cash_trips",
  "cbd_fee",
  "wait_s",
  "wait_trips",
  "driver_pay",
  "shared_trips",
];

const csv = (columns: string[], rows: (string | number | null)[][]) =>
  [
    columns.join(","),
    ...rows.map((row) =>
      row.map((v) => (v === null ? "" : String(v))).join(","),
    ),
  ].join("\n") + "\n";

const dailyRows = () =>
  dateRange(FIXTURE_PERIOD.from, FIXTURE_PERIOD.to).flatMap((date) => {
    const y = dailyTrips(date, "yellow");
    const u = dailyTrips(date, "uber");
    const l = dailyTrips(date, "lyft");
    return [
      // yellow at Midtown Center (161, Manhattan): fare 15, revenue 20, 2 mi, 10 min
      [
        date,
        "yellow",
        "yellow",
        161,
        y,
        y,
        y,
        y * 20,
        y * 15,
        y * 2,
        y * 2,
        y * 600,
        0,
        Math.round(y * 0.8),
        Math.round(y * 0.2),
        y * 0.75,
        null,
        null,
        null,
        null,
      ],
      // uber at JFK (132, Queens): fare 30, revenue 40, wait 5 min
      [
        date,
        "fhvhv",
        "uber",
        132,
        u,
        null,
        null,
        u * 40,
        u * 30,
        u * 3,
        u * 10,
        u * 1500,
        u,
        null,
        null,
        u * 1.5,
        u * 300,
        u,
        u * 22,
        10,
      ],
      // lyft at JFK: wait 6 min
      [
        date,
        "fhvhv",
        "lyft",
        132,
        l,
        null,
        null,
        l * 38,
        l * 28,
        l * 2,
        l * 9,
        l * 1400,
        l,
        null,
        null,
        l * 1.5,
        l * 360,
        l,
        l * 20,
        0,
      ],
    ];
  });

const hourlyRows = () =>
  ["2026-09-01", "2026-09-02"].flatMap((date) =>
    Array.from({ length: 24 }, (_, h) => {
      const hour = `${date} ${String(h).padStart(2, "0")}:00:00`;
      return [
        hour,
        "yellow",
        "yellow",
        10 + h,
        10 + h,
        10 + h,
        (10 + h) * 20,
        (10 + h) * 15,
        10 + h,
        20,
        6000,
        0,
        8,
        2,
        7.5,
        null,
        null,
        null,
        null,
      ];
    }),
  );

const odRows = () =>
  ["2026-08-01", "2026-09-01"].flatMap((month) => [
    [month, "fhvhv", "uber", "queens", 132, 161, 200, 12000, 3000, 360000],
    [month, "yellow", "yellow", "manhattan", 161, 230, 150, 3000, 150, 60000],
  ]);

const sampleRows = () =>
  Array.from({ length: 20 }, (_, i) => [
    i + 1,
    i % 2 ? "fhvhv" : "yellow",
    i % 2 ? "uber" : "yellow",
    `2026-09-${String((i % 28) + 1).padStart(2, "0")} ${String(i % 24).padStart(2, "0")}:00:00`,
    i % 2 ? 132 : 161,
    230,
    1 + i,
    600 + i * 30,
    10 + i,
    1,
    15 + i,
    i % 2 ? 240 : null,
    i === 19 ? null : -73.9 + i / 1000,
    i === 19 ? null : 40.7,
  ]);

const TABLES = {
  agg_daily_zone: { columns: DAILY_COLUMNS, rows: dailyRows },
  agg_hourly: {
    columns: ["hour", "service", "company", ...DAILY_COLUMNS.slice(4)],
    rows: hourlyRows,
  },
  agg_od_monthly: {
    columns: [
      "month",
      "service",
      "company",
      "pu_borough",
      "pu_zone_id",
      "do_zone_id",
      "trips",
      "revenue",
      "distance_mi",
      "duration_s",
    ],
    rows: odRows,
  },
  trip_sample: {
    columns: [
      "sample_id",
      "service",
      "company",
      "pickup_at",
      "pu_zone_id",
      "do_zone_id",
      "distance_mi",
      "duration_s",
      "fare",
      "tips",
      "revenue",
      "wait_s",
      "lon",
      "lat",
    ],
    rows: sampleRows,
  },
};

/** Writes the fixture snapshot (gzip CSV + manifest with sha256) into `dir`. */
export const writeFixtureSnapshot = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
  const tables: Record<string, unknown> = {};
  let totalBytes = 0;
  for (const [table, { columns, rows }] of Object.entries(TABLES)) {
    const data = rows();
    const content = gzipSync(csv(columns, data));
    const file = `${table}.000.csv.gz`;
    await writeFile(join(dir, file), content);
    totalBytes += content.length;
    tables[table] = {
      rows: data.length,
      columns: columns.map((name) => ({ name, type: "VARCHAR" })),
      files: [
        {
          file,
          rows: data.length,
          bytes: content.length,
          sha256: createHash("sha256").update(content).digest("hex"),
        },
      ],
    };
  }
  const manifest = {
    formatVersion: 1,
    generatedAt: "2026-11-17T00:00:00.000Z",
    period: { from: "2026-08", to: "2026-09" },
    sampleMonth: "2026-09",
    sources: [],
    tables,
    totalBytes,
  };
  await writeFile(
    join(dir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
};
