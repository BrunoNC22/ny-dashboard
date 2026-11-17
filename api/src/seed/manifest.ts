import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

/** Snapshot format supported by this seed (see api/etl/lib/snapshot.ts). */
export const SUPPORTED_FORMAT_VERSION = 1;

const fileSchema = z.object({
  file: z.string().regex(/^[\w.-]+\.csv\.gz$/),
  rows: z.number().int().min(0),
  bytes: z.number().int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const manifestSchema = z.object({
  formatVersion: z.number().int(),
  generatedAt: z.string(),
  period: z.object({ from: z.string(), to: z.string() }),
  sampleMonth: z.string().nullable(),
  tables: z.record(
    z.string(),
    z.object({
      rows: z.number().int().min(0),
      columns: z.array(z.object({ name: z.string(), type: z.string() })),
      files: z.array(fileSchema),
    }),
  ),
  totalBytes: z.number().int(),
});
export type SnapshotManifest = z.infer<typeof manifestSchema>;

/** Snapshot table → database table. */
export const TABLE_TARGETS: Readonly<Record<string, string>> = {
  agg_daily_zone: "trip_daily",
  agg_hourly: "trip_hourly",
  agg_od_monthly: "od_flow_monthly",
  trip_sample: "trip_sample",
};

const sha256File = (path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => {
        resolve(hash.digest("hex"));
      })
      .on("error", reject);
  });

export interface LoadedManifest {
  manifest: SnapshotManifest;
  /** sha256 of manifest.json: identifies the snapshot version in seed_meta. */
  checksum: string;
}

/** Reads and validates manifest.json, then checks every data file's checksum. */
export const loadManifest = async (dir: string): Promise<LoadedManifest> => {
  const raw = await readFile(join(dir, "manifest.json"), "utf8");
  const manifest = manifestSchema.parse(JSON.parse(raw));
  if (manifest.formatVersion !== SUPPORTED_FORMAT_VERSION) {
    throw new Error(
      `Unsupported snapshot format ${String(manifest.formatVersion)} (expected ${String(SUPPORTED_FORMAT_VERSION)})`,
    );
  }
  for (const table of Object.keys(TABLE_TARGETS)) {
    if (!manifest.tables[table])
      throw new Error(`Snapshot is missing table ${table}`);
  }
  for (const [table, { files }] of Object.entries(manifest.tables)) {
    for (const file of files) {
      const actual = await sha256File(join(dir, file.file));
      if (actual !== file.sha256) {
        throw new Error(
          `Checksum mismatch for ${table}/${file.file}: snapshot is corrupted`,
        );
      }
    }
  }
  return { manifest, checksum: createHash("sha256").update(raw).digest("hex") };
};
