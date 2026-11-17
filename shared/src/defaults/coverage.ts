import type { DateRange } from "../primitives";

/**
 * Period covered by the versioned snapshot (CLAUDE.md §5.2). Update together with the snapshot
 * (see "Atualização mensal" in api/etl/README.md).
 */
export const DATA_COVERAGE = {
  period: { from: "2024-10-01", to: "2026-09-30" } satisfies DateRange,
  /** Month of the individual-trip sample (last month of the snapshot). */
  sampleMonth: "2026-09",
  /** Last month with data: the default period of the dashboard. */
  lastMonth: { from: "2026-09-01", to: "2026-09-30" } satisfies DateRange,
  /** Holt-Winters forecast horizon after the data (CLAUDE.md §5.8). */
  forecastUntil: "2026-12-31",
} as const;
