import type { Service } from "@ny-dashboard/shared";

import type { Duck } from "./duckdb";
import type { Month } from "./months";
import {
  DISCARD_REASONS,
  type DiscardReason,
  NORMALIZED_COLUMNS,
  normalizedTripsSql,
} from "./sources";

export interface SourceReport {
  month: Month;
  service: Service;
  read: number;
  kept: number;
  discarded: Record<DiscardReason, number>;
}

export interface StepContext {
  duck: Duck;
  month: Month;
  service: Service;
}

/**
 * A processing step run for every month × service after normalization.
 * Steps read from the `trips` view (clean, normalized trips). Aggregations (#8–#11) plug in here.
 */
export interface EtlStep {
  name: string;
  run(context: StepContext): Promise<void>;
}

/**
 * Creates the `normalized` (all rows + discard_reason) and `trips` (kept rows only) views for one
 * parquet file, counts kept/discarded rows and runs the steps.
 */
export const processSource = async (
  duck: Duck,
  service: Service,
  month: Month,
  parquetPath: string,
  steps: readonly EtlStep[] = [],
): Promise<SourceReport> => {
  const columns = await duck.parquetColumns(parquetPath);
  await duck.run(
    `CREATE OR REPLACE VIEW normalized AS ${normalizedTripsSql(service, parquetPath, columns, month)}`,
  );
  await duck.run(
    `CREATE OR REPLACE VIEW trips AS SELECT ${NORMALIZED_COLUMNS.join(", ")} FROM normalized WHERE discard_reason IS NULL`,
  );

  const counts = await duck.all<{ reason: string | null; n: number }>(
    "SELECT discard_reason AS reason, count(*) AS n FROM normalized GROUP BY ALL",
  );
  const discarded = Object.fromEntries(
    DISCARD_REASONS.map((reason) => [reason, 0]),
  ) as Record<DiscardReason, number>;
  let kept = 0;
  for (const { reason, n } of counts) {
    if (reason === null) kept = n;
    else discarded[reason as DiscardReason] = n;
  }
  const read = counts.reduce((sum, row) => sum + row.n, 0);

  for (const step of steps) await step.run({ duck, month, service });
  return { month, service, read, kept, discarded };
};

const fmt = (n: number): string => n.toLocaleString("en-US");

export const formatReport = (report: SourceReport): string => {
  const discardedTotal = report.read - report.kept;
  const pct =
    report.read > 0
      ? ((100 * discardedTotal) / report.read).toFixed(2)
      : "0.00";
  const reasons = Object.entries(report.discarded)
    .filter(([, n]) => n > 0)
    .map(([reason, n]) => `${reason} ${fmt(n)}`)
    .join(", ");
  return (
    `${report.month} ${report.service.padEnd(6)} read ${fmt(report.read)}, kept ${fmt(report.kept)}, ` +
    `discarded ${fmt(discardedTotal)} (${pct}%)${reasons ? `: ${reasons}` : ""}`
  );
};
