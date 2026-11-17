import type { EtlStep } from "../lib/pipeline";
import { OD_TOP_N } from "../lib/sources";
import { replaceMonth } from "../lib/store";

/**
 * Table 3 of the snapshot: top origin → destination routes per month × service × company ×
 * pickup borough (CLAUDE.md §5.6). Trips with an invalid dropoff zone are ignored.
 */
export const createOdMonthlyStep = (topN: number = OD_TOP_N): EtlStep => ({
  name: "agg_od_monthly",
  run: ({ duck, month, service }) =>
    replaceMonth(
      duck,
      "agg_od_monthly",
      "month",
      service,
      month,
      `SELECT
        date_trunc('month', pickup_at)::DATE AS month,
        service,
        company,
        z.borough AS pu_borough,
        pu_zone_id,
        do_zone_id,
        count(*) AS trips,
        sum(revenue) AS revenue,
        sum(distance_mi) AS distance_mi,
        sum(duration_s) AS duration_s
      FROM trips t
      JOIN zones z ON z.zone_id = t.pu_zone_id
      WHERE do_zone_id BETWEEN 1 AND 265
      GROUP BY month, service, company, pu_borough, pu_zone_id, do_zone_id
      QUALIFY row_number() OVER (
        PARTITION BY month, service, company, pu_borough
        ORDER BY trips DESC, pu_zone_id, do_zone_id
      ) <= ${String(topN)}`,
    ),
});

export const odMonthlyStep = createOdMonthlyStep();
