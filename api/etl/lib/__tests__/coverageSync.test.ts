import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DATA_COVERAGE } from "@ny-dashboard/shared";
import { describe, expect, it } from "vitest";

import { SNAPSHOT_DIR } from "../paths";
import type { Manifest } from "../snapshot";

describe("DATA_COVERAGE matches the versioned snapshot", () => {
  it("has the same period and sample month as manifest.json", async () => {
    const manifest = JSON.parse(
      await readFile(join(SNAPSHOT_DIR, "manifest.json"), "utf8"),
    ) as Manifest;
    expect(manifest.period.from).toBe(DATA_COVERAGE.period.from.slice(0, 7));
    expect(manifest.period.to).toBe(DATA_COVERAGE.period.to.slice(0, 7));
    expect(manifest.sampleMonth).toBe(DATA_COVERAGE.sampleMonth);
  });
});
