import { join } from "node:path";

import { type Duck, sqlString } from "../duckdb";

/**
 * Builders for fixture parquet files that use the official TLC column names and types
 * (see api/etl/README.md). Each builder returns a `SELECT` producing one row; combine rows
 * with `UNION ALL` and write them with `writeParquet`.
 */
export const writeParquet = async (
  duck: Duck,
  dir: string,
  name: string,
  rows: string[],
): Promise<string> => {
  const path = join(dir, name);
  await duck.run(
    `COPY (${rows.join(" UNION ALL ")}) TO ${sqlString(path)} (FORMAT parquet)`,
  );
  return path;
};

export const yellowRow = (
  id: number,
  pickup: string,
  dropoff: string,
  {
    pax = 1,
    dist = 2,
    pu = 161,
    dropZone = 236,
    pay = 1,
    fare = 10,
    tip = 2,
    total = 15,
    cbd = 0.75,
  } = {},
): string =>
  `SELECT ${String(id)}::INTEGER AS VendorID, TIMESTAMP '${pickup}' AS tpep_pickup_datetime, ` +
  `TIMESTAMP '${dropoff}' AS tpep_dropoff_datetime, ${String(pax)}::BIGINT AS passenger_count, ` +
  `${String(dist)}::DOUBLE AS trip_distance, ${pu === 0 ? "NULL" : String(pu)}::INTEGER AS PULocationID, ` +
  `${dropZone === 0 ? "NULL" : String(dropZone)}::INTEGER AS DOLocationID, ${String(pay)}::BIGINT AS payment_type, ` +
  `${String(fare)}::DOUBLE AS fare_amount, ${String(tip)}::DOUBLE AS tip_amount, ` +
  `${String(total)}::DOUBLE AS total_amount, ${String(cbd)}::DOUBLE AS cbd_congestion_fee`;

export const greenRow = (
  pickup: string,
  dropoff: string,
  { pu = 74, dropZone = 1, pay = "NULL", dist = 3.5 } = {},
): string =>
  `SELECT TIMESTAMP '${pickup}' AS lpep_pickup_datetime, TIMESTAMP '${dropoff}' AS lpep_dropoff_datetime, ` +
  `NULL::BIGINT AS passenger_count, ${String(dist)}::DOUBLE AS trip_distance, ` +
  `${String(pu)}::INTEGER AS PULocationID, ${String(dropZone)}::INTEGER AS DOLocationID, ` +
  `${pay}::BIGINT AS payment_type, 18::DOUBLE AS fare_amount, 0::DOUBLE AS tip_amount, ` +
  `22.5::DOUBLE AS total_amount`;

export const fhvhvRow = (
  license: string,
  request: string | null,
  pickup: string,
  {
    shared = "N",
    airportFee = "2.5",
    cbd = true,
    pu = 79,
    dropZone = 138,
  } = {},
): string =>
  `SELECT '${license}' AS hvfhs_license_num, ` +
  `${request ? `TIMESTAMP '${request}'` : "NULL::TIMESTAMP"} AS request_datetime, ` +
  `TIMESTAMP '${pickup}' AS pickup_datetime, TIMESTAMP '${pickup}' + INTERVAL 15 MINUTE AS dropoff_datetime, ` +
  `${String(pu)}::INTEGER AS PULocationID, ${String(dropZone)}::INTEGER AS DOLocationID, ` +
  `5.2::DOUBLE AS trip_miles, 900::BIGINT AS trip_time, ` +
  `20::DOUBLE AS base_passenger_fare, 1::DOUBLE AS tolls, 0.5::DOUBLE AS bcf, 1.8::DOUBLE AS sales_tax, ` +
  `2.75::DOUBLE AS congestion_surcharge, ${airportFee}::DOUBLE AS airport_fee, 3::DOUBLE AS tips, ` +
  `16::DOUBLE AS driver_pay, '${shared}' AS shared_match_flag` +
  (cbd ? ", 1.5::DOUBLE AS cbd_congestion_fee" : "");
