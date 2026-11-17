import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { BASE_COLUMNS } from "@ny-dashboard/shared";
import { describe, expect, it } from "vitest";

import { METRIC_COLUMN_NAMES } from "../metrics";
import { API_DIR } from "../paths";

describe("base columns stay in sync", () => {
  it("shared catalog = ETL aggregates", () => {
    expect(METRIC_COLUMN_NAMES).toEqual([...BASE_COLUMNS]);
  });

  it("shared catalog = Prisma TripDaily/TripHourly/Projection columns", async () => {
    const schema = await readFile(
      join(API_DIR, "prisma", "schema.prisma"),
      "utf8",
    );
    for (const model of ["TripDaily", "TripHourly", "Projection"]) {
      const body =
        new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(schema)?.[1] ??
        "";
      const columns = [
        ...body.matchAll(/^\s+(\w+)\s+\w+\??(?:\s+@map\("(\w+)"\))?/gm),
      ].map(([, field = "", mapped]) => mapped ?? field);
      for (const column of BASE_COLUMNS) {
        expect(columns, `${model}.${column}`).toContain(column);
      }
    }
  });
});
