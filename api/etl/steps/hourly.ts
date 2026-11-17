import { METRIC_AGGREGATES_SQL } from "../lib/metrics";
import type { EtlStep } from "../lib/pipeline";
import { replaceMonth } from "../lib/store";

/**
 * Table 2 of the snapshot: hour (New York wall clock) × service × company, sums only
 * (CLAUDE.md §5.6). Feeds hourly series (~17.5k points per series over 24 months) and the
 * hour-of-day × day-of-week cuts.
 */
export const hourlyStep: EtlStep = {
  name: "agg_hourly",
  run: ({ duck, month, service }) =>
    replaceMonth(
      duck,
      "agg_hourly",
      "hour",
      service,
      month,
      `SELECT date_trunc('hour', pickup_at) AS hour, service, company, ${METRIC_AGGREGATES_SQL}
      FROM trips
      GROUP BY hour, service, company`,
    ),
};
