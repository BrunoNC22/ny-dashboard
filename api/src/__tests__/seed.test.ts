import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../lib/password";
import { API_ROOT, findApiRoot, SNAPSHOT_DIR } from "../lib/paths";
import { loadManifest, TABLE_TARGETS } from "../seed/manifest";

describe("paths", () => {
  it("finds the api package root from nested directories", () => {
    expect(findApiRoot(join(API_ROOT, "src", "seed"))).toBe(API_ROOT);
    expect(() => findApiRoot("/")).toThrow(/api package root/);
  });
});

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("demo1234");
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await verifyPassword("demo1234", hash)).toBe(true);
    expect(await verifyPassword("demo12345", hash)).toBe(false);
  });
});

describe("loadManifest", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "seed-manifest-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const fakeSnapshot = async (
    mutate?: (manifest: Record<string, unknown>) => void,
  ) => {
    const tables: Record<string, unknown> = {};
    for (const table of Object.keys(TABLE_TARGETS)) {
      const file = `${table}.000.csv.gz`;
      const content = `content of ${table}`;
      await writeFile(join(dir, file), content);
      tables[table] = {
        rows: 1,
        columns: [{ name: "x", type: "INTEGER" }],
        files: [
          {
            file,
            rows: 1,
            bytes: content.length,
            sha256: createHash("sha256").update(content).digest("hex"),
          },
        ],
      };
    }
    const manifest: Record<string, unknown> = {
      formatVersion: 1,
      generatedAt: "2026-11-17T00:00:00.000Z",
      period: { from: "2024-10", to: "2026-09" },
      sampleMonth: "2026-09",
      tables,
      totalBytes: 100,
    };
    mutate?.(manifest);
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
  };

  it("accepts a consistent snapshot and fingerprints the manifest", async () => {
    await fakeSnapshot();
    const { manifest, checksum } = await loadManifest(dir);
    expect(manifest.period).toEqual({ from: "2024-10", to: "2026-09" });
    const raw = await readFile(join(dir, "manifest.json"));
    expect(checksum).toBe(createHash("sha256").update(raw).digest("hex"));
  });

  it("detects corrupted files", async () => {
    await fakeSnapshot();
    await writeFile(join(dir, "trip_sample.000.csv.gz"), "tampered");
    await expect(loadManifest(dir)).rejects.toThrow(
      "Checksum mismatch for trip_sample/trip_sample.000.csv.gz",
    );
  });

  it("rejects unsupported formats and missing tables", async () => {
    await fakeSnapshot((m) => {
      m.formatVersion = 2;
    });
    await expect(loadManifest(dir)).rejects.toThrow(
      /Unsupported snapshot format 2/,
    );

    await fakeSnapshot((m) => {
      delete (m.tables as Record<string, unknown>).agg_hourly;
    });
    await expect(loadManifest(dir)).rejects.toThrow(
      "Snapshot is missing table agg_hourly",
    );
  });

  it("validates the real versioned snapshot", async () => {
    const copy = join(dir, "real");
    await cp(SNAPSHOT_DIR, copy, { recursive: true });
    const { manifest } = await loadManifest(copy);
    expect(manifest.tables.trip_sample?.rows).toBe(1_000_000);
  });
});
