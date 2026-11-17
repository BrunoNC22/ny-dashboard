import type { Service } from "@ny-dashboard/shared";

import { sqlString } from "./duckdb";
import { type Month, nextMonth } from "./months";

export const TRIP_DATA_BASE_URL =
  "https://d37ci6vzurychx.cloudfront.net/trip-data";

export const tripDataUrl = (service: Service, month: Month): string =>
  `${TRIP_DATA_BASE_URL}/${service}_tripdata_${month}.parquet`;

/** Cleaning thresholds (CLAUDE.md §5.5). */
export const LIMITS = {
  /** Trips longer than this are discarded. */
  maxDurationS: 3 * 60 * 60,
  /** Implied average speed above this means a broken distance reading. */
  maxSpeedMph: 80,
  /** Fares above this are data-entry errors (e.g. US$ 9,999.70 for a 1-minute trip). */
  maxFare: 1000,
} as const;

/** Airports: EWR (1), JFK (132), LGA (138). */
export const AIRPORT_ZONES = [1, 132, 138] as const;

export const DISCARD_REASONS = [
  "invalid_pickup_zone",
  "outside_month",
  "negative_fare",
  "fare_over_limit",
  "non_positive_distance",
  "invalid_duration",
  "speed_over_limit",
] as const;
export type DiscardReason = (typeof DISCARD_REASONS)[number];

/**
 * Normalized trip columns (CLAUDE.md §5.4). Columns that do not exist for a service are NULL.
 * Documented in api/etl/README.md.
 */
export const NORMALIZED_COLUMNS = [
  "service",
  "company",
  "pickup_at",
  "dropoff_at",
  "pu_zone_id",
  "do_zone_id",
  "passengers",
  "revenue",
  "fare",
  "tips",
  "distance_mi",
  "duration_s",
  "is_airport",
  "payment",
  "cbd_fee",
  "wait_s",
  "driver_pay",
  "is_shared",
] as const;

/** `col` when the parquet has it, otherwise the fallback expression. */
const optional = (
  columns: ReadonlySet<string>,
  col: string,
  fallback: string,
): string => (columns.has(col) ? col : fallback);

/** `COALESCE(col, 0)` when the column exists, otherwise 0. */
const amount = (columns: ReadonlySet<string>, col: string): string =>
  columns.has(col) ? `COALESCE(${col}, 0)` : "0";

/** Raw parquet → normalized columns (before cleaning). */
const selectNormalized = (
  service: Service,
  columns: ReadonlySet<string>,
): string => {
  switch (service) {
    case "yellow":
    case "green": {
      const prefix = service === "yellow" ? "tpep" : "lpep";
      return `
        '${service}' AS service,
        '${service}' AS company,
        ${prefix}_pickup_datetime AS pickup_at,
        ${prefix}_dropoff_datetime AS dropoff_at,
        PULocationID AS pu_zone_id,
        DOLocationID AS do_zone_id,
        NULLIF(passenger_count, 0)::DOUBLE AS passengers,
        total_amount AS revenue,
        fare_amount AS fare,
        tip_amount AS tips,
        trip_distance AS distance_mi,
        epoch(${prefix}_dropoff_datetime - ${prefix}_pickup_datetime)::DOUBLE AS duration_s,
        CASE payment_type WHEN 1 THEN 'card' WHEN 2 THEN 'cash' WHEN 0 THEN 'flex' ELSE 'other' END AS payment,
        ${amount(columns, "cbd_congestion_fee")}::DOUBLE AS cbd_fee,
        NULL::DOUBLE AS wait_s,
        NULL::DOUBLE AS driver_pay,
        NULL::BOOLEAN AS is_shared`;
    }
    case "fhvhv":
      return `
        'fhvhv' AS service,
        CASE hvfhs_license_num WHEN 'HV0003' THEN 'uber' WHEN 'HV0005' THEN 'lyft' ELSE 'other' END AS company,
        pickup_datetime AS pickup_at,
        dropoff_datetime AS dropoff_at,
        PULocationID AS pu_zone_id,
        DOLocationID AS do_zone_id,
        NULL::DOUBLE AS passengers,
        (${[
          "base_passenger_fare",
          "tolls",
          "bcf",
          "sales_tax",
          "congestion_surcharge",
          "airport_fee",
          "tips",
          "cbd_congestion_fee",
        ]
          .map((col) => amount(columns, col))
          .join(" + ")})::DOUBLE AS revenue,
        base_passenger_fare AS fare,
        tips AS tips,
        trip_miles AS distance_mi,
        trip_time::DOUBLE AS duration_s,
        NULL::VARCHAR AS payment,
        ${amount(columns, "cbd_congestion_fee")}::DOUBLE AS cbd_fee,
        CASE WHEN ${optional(columns, "request_datetime", "NULL")} IS NOT NULL AND pickup_datetime >= request_datetime
          THEN epoch(pickup_datetime - request_datetime)::DOUBLE END AS wait_s,
        driver_pay AS driver_pay,
        (shared_match_flag = 'Y') AS is_shared`;
  }
};

/**
 * SQL producing the normalized trips of one month/service, plus `discard_reason`
 * (NULL when the trip is kept). Rules are evaluated in order; the first match wins.
 */
export const normalizedTripsSql = (
  service: Service,
  parquetPath: string,
  columns: ReadonlySet<string>,
  month: Month,
): string => {
  const start = `TIMESTAMP '${month}-01 00:00:00'`;
  const end = `TIMESTAMP '${nextMonth(month)}-01 00:00:00'`;
  const airports = AIRPORT_ZONES.join(", ");
  return `
    WITH raw AS (
      SELECT ${selectNormalized(service, columns)}
      FROM read_parquet(${sqlString(parquetPath)})
    )
    SELECT
      raw.*,
      (pu_zone_id IN (${airports}) OR do_zone_id IN (${airports})) IS TRUE AS is_airport,
      CASE
        WHEN pu_zone_id IS NULL OR pu_zone_id NOT BETWEEN 1 AND 265 THEN 'invalid_pickup_zone'
        WHEN pickup_at IS NULL OR pickup_at < ${start} OR pickup_at >= ${end} THEN 'outside_month'
        WHEN fare IS NULL OR fare < 0 THEN 'negative_fare'
        WHEN fare > ${String(LIMITS.maxFare)} THEN 'fare_over_limit'
        WHEN distance_mi IS NULL OR distance_mi <= 0 THEN 'non_positive_distance'
        WHEN duration_s IS NULL OR duration_s <= 0 OR duration_s > ${String(LIMITS.maxDurationS)} THEN 'invalid_duration'
        WHEN distance_mi / (duration_s / 3600) > ${String(LIMITS.maxSpeedMph)} THEN 'speed_over_limit'
      END AS discard_reason
    FROM raw`;
};
