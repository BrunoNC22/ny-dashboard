/**
 * Base metric columns shared by the time-based aggregates (sums and denominators only;
 * CLAUDE.md §5.4/§5.6). Columns that do not apply to a service are NULL.
 */
export const METRIC_COLUMNS_DDL = `
    trips BIGINT NOT NULL,
    passengers DOUBLE,
    passenger_trips BIGINT,
    revenue DOUBLE NOT NULL,
    fare DOUBLE NOT NULL,
    tips DOUBLE NOT NULL,
    distance_mi DOUBLE NOT NULL,
    duration_s DOUBLE NOT NULL,
    airport_trips BIGINT NOT NULL,
    card_trips BIGINT,
    cash_trips BIGINT,
    cbd_fee DOUBLE NOT NULL,
    wait_s DOUBLE,
    wait_trips BIGINT,
    driver_pay DOUBLE,
    shared_trips BIGINT`;

/** Aggregates over the `trips` view matching `METRIC_COLUMNS_DDL` (group by must include `service`). */
export const METRIC_AGGREGATES_SQL = `
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
    CASE WHEN service = 'fhvhv' THEN count_if(is_shared) END AS shared_trips`;

/** Names of the metric columns, in table order. */
export const METRIC_COLUMN_NAMES = METRIC_COLUMNS_DDL.split(",").map(
  (line) => line.trim().split(/\s+/)[0] ?? "",
);
