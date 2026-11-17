import { METRIC_AGGREGATES_SQL } from "../lib/metrics";
import type { EtlStep } from "../lib/pipeline";
import { replaceMonth } from "../lib/store";

/**
 * Table 1 of the snapshot: daily (New York date) × pickup zone × service × company, sums only
 * (CLAUDE.md §5.6). Columns that do not apply to a service are NULL; `*_trips` counters give
 * the denominators of metrics whose base value can be missing (passengers, wait time).
 */
export const dailyZoneStep: EtlStep = {
  name: "agg_daily_zone",
  run: ({ duck, month, service }) =>
    replaceMonth(
      duck,
      "agg_daily_zone",
      "date",
      service,
      month,
      `SELECT CAST(pickup_at AS DATE) AS date, service, company, pu_zone_id, ${METRIC_AGGREGATES_SQL}
      FROM trips
      GROUP BY date, service, company, pu_zone_id`,
    ),
};
