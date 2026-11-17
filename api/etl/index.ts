/**
 * NYC TLC trip data ETL.
 *
 *   pnpm --filter @ny-dashboard/api etl [--from 2024-10] [--to 2026-09]
 *        [--services yellow,green,fhvhv] [--keep-cache] [--refresh]
 *
 * For each month × service: downloads the parquet (one polite GET, with retries), normalizes and
 * cleans the trips with DuckDB, runs the aggregation steps and deletes the file (unless
 * --keep-cache). See api/etl/README.md.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { type Service, SERVICES, serviceSchema } from "@ny-dashboard/shared";

import { downloadToCache, removeFromCache } from "./lib/download";
import { Duck } from "./lib/duckdb";
import { type Month, monthRange, parseMonth } from "./lib/months";
import { CACHE_DIR } from "./lib/paths";
import {
  type EtlStep,
  formatReport,
  processSource,
  type SourceReport,
} from "./lib/pipeline";
import { tripDataUrl } from "./lib/sources";
import { ensureStore, ETL_DB_PATH, saveSourceReport } from "./lib/store";
import { dailyZoneStep } from "./steps/dailyZone";
import { hourlyStep } from "./steps/hourly";
import { odMonthlyStep } from "./steps/odMonthly";
import { createTripSampleStep } from "./steps/tripSample";

/** Snapshot period (CLAUDE.md §5.2). */
const DEFAULT_FROM: Month = "2024-10";
const DEFAULT_TO: Month = "2026-09";

/** Aggregation steps (#8–#11). The trip sample uses the last month of the run. */
const createSteps = (sampleMonth: Month): EtlStep[] => [
  dailyZoneStep,
  hourlyStep,
  odMonthlyStep,
  createTripSampleStep({ month: sampleMonth }),
];

const parseServices = (value: string): Service[] =>
  value.split(",").map((service) => serviceSchema.parse(service.trim()));

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      from: { type: "string", default: DEFAULT_FROM },
      to: { type: "string", default: DEFAULT_TO },
      services: { type: "string", default: SERVICES.join(",") },
      "keep-cache": { type: "boolean", default: false },
      refresh: { type: "boolean", default: false },
    },
  });
  const months = monthRange(parseMonth(values.from), parseMonth(values.to));
  const services = parseServices(values.services);
  console.log(
    `etl        ${months[0] ?? ""} → ${months.at(-1) ?? ""}, services: ${services.join(", ")}`,
  );

  const steps = createSteps(months.at(-1) ?? DEFAULT_TO);
  const duck = await Duck.open(ETL_DB_PATH);
  await ensureStore(duck);
  const reports: SourceReport[] = [];
  try {
    for (const month of months) {
      for (const service of services) {
        const path = await downloadToCache(tripDataUrl(service, month), {
          refresh: values.refresh,
        });
        const report = await processSource(duck, service, month, path, steps);
        reports.push(report);
        await saveSourceReport(duck, report);
        console.log(formatReport(report));
        if (!values["keep-cache"]) await removeFromCache(path);
      }
    }
    for (const step of steps) await step.finalize?.(duck);
  } finally {
    duck.close();
  }

  const reportPath = join(CACHE_DIR, "etl-report.json");
  await writeFile(reportPath, `${JSON.stringify(reports, null, 2)}\n`);
  console.log(`report     ${reportPath}`);
};

await main();
