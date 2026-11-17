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
      `SELECT
        CAST(pickup_at AS DATE) AS date,
        service,
        company,
        pu_zone_id,
        count(*) AS trips,
        CASE WHEN service = 'fhvhv' THEN NULL ELSE COALESCE(sum(passengers), 0) END AS passengers,
        CASE WHEN service = 'fhvhv' THEN NULL ELSE count(passengers) END AS passenger_trips,
        sum(revenue) AS revenue,
        sum(fare) AS fare,
        sum(tips) AS tips,
        sum(distance_mi) AS distance_mi,
        sum(duration_s) AS duration_s,
        count_if(is_airport) AS airport_trips,
        CASE WHEN service = 'fhvhv' THEN NULL ELSE count_if(payment = 'card') END AS card_trips,
        CASE WHEN service = 'fhvhv' THEN NULL ELSE count_if(payment = 'cash') END AS cash_trips,
        sum(cbd_fee) AS cbd_fee,
        CASE WHEN service = 'fhvhv' THEN COALESCE(sum(wait_s), 0) END AS wait_s,
        CASE WHEN service = 'fhvhv' THEN count(wait_s) END AS wait_trips,
        CASE WHEN service = 'fhvhv' THEN sum(driver_pay) END AS driver_pay,
        CASE WHEN service = 'fhvhv' THEN count_if(is_shared) END AS shared_trips
      FROM trips
      GROUP BY date, service, company, pu_zone_id`,
    ),
};
