import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Service } from "@ny-dashboard/shared";

import type { Duck } from "../lib/duckdb";
import {
  bboxOf,
  type Position,
  randomPointInZone,
  type Zone,
  type ZoneGeometry,
} from "../lib/geo";
import { ZONES_DIR } from "../lib/paths";
import type { EtlStep } from "../lib/pipeline";
import { computeQuotas } from "../lib/sample";
import { SAMPLE } from "../lib/sources";

export interface SampleOptions {
  month: string;
  size: number;
  floorPerService: number;
  zonesPath: string;
  log: (message: string) => void;
}

const SAMPLE_COLUMNS =
  "service, company, pickup_at, pu_zone_id, do_zone_id, distance_mi, duration_s, fare, tips, revenue, wait_s";

/**
 * Deterministic order key: same trips → same sample, independent of thread scheduling.
 * Exact duplicate rows share a key, which is harmless.
 */
const SAMPLE_KEY = `hash(service, company, pickup_at, dropoff_at, pu_zone_id, do_zone_id, fare,
  distance_mi, duration_s, revenue, 'ny-dashboard-sample-v1')`;

interface ZoneFeature {
  id: number;
  geometry: ZoneGeometry;
  properties: { centroid: Position };
}

export const loadZones = async (path: string): Promise<Map<number, Zone>> => {
  const collection = JSON.parse(await readFile(path, "utf8")) as {
    features: ZoneFeature[];
  };
  return new Map(
    collection.features.map((feature) => [
      feature.id,
      {
        geometry: feature.geometry,
        bbox: bboxOf(feature.geometry),
        centroid: feature.properties.centroid,
      },
    ]),
  );
};

/**
 * Table 4 of the snapshot (CLAUDE.md §5.6): ~1M individual trips of the last month.
 * - run: for the sample month, keeps the first `size` trips of the service ordered by a hash
 *   (a uniform, reproducible sample) as candidates.
 * - finalize: splits `size` among services (proportional, with a floor per service), then gives
 *   each trip a deterministic random position inside its pickup zone (the TLC publishes no
 *   coordinates). Zones without geometry (264/265) get NULL coordinates.
 */
export const createTripSampleStep = (
  overrides: Partial<SampleOptions> = {},
): EtlStep => {
  const options: SampleOptions = {
    month: SAMPLE.month,
    size: SAMPLE.size,
    floorPerService: SAMPLE.floorPerService,
    zonesPath: join(ZONES_DIR, "taxi_zones.geojson"),
    log: console.log,
    ...overrides,
  };

  return {
    name: "trip_sample",
    async run({ duck, month, service }) {
      if (month !== options.month) return;
      await duck.run(
        `DELETE FROM sample_candidates WHERE service = '${service}'`,
      );
      await duck.run(
        `INSERT INTO sample_candidates
         SELECT ${SAMPLE_COLUMNS}, ${SAMPLE_KEY} AS sample_key FROM trips
         ORDER BY sample_key, pickup_at, pu_zone_id
         LIMIT ${String(options.size)}`,
      );
    },
    async finalize(duck) {
      const available = await duck.all<{ service: Service; kept: number }>(
        `SELECT service, kept FROM etl_sources WHERE month = '${options.month}' ORDER BY service`,
      );
      if (available.length === 0) {
        options.log(
          `sample     skipped (month ${options.month} not processed yet)`,
        );
        return;
      }
      const quotas = computeQuotas(
        Object.fromEntries(available.map((row) => [row.service, row.kept])),
        options.size,
        options.floorPerService,
      );
      await buildSample(duck, quotas, await loadZones(options.zonesPath));
      const counts = await duck.all<{
        service: string;
        n: number;
        no_position: number;
      }>(
        "SELECT service, count(*) AS n, count(*) FILTER (WHERE lon IS NULL) AS no_position FROM trip_sample GROUP BY ALL ORDER BY ALL",
      );
      options.log(
        `sample     ${counts.map((c) => `${c.service} ${c.n.toLocaleString("en-US")}`).join(", ")}` +
          ` (without position: ${String(counts.reduce((sum, c) => sum + c.no_position, 0))})`,
      );
    },
  };
};

const buildSample = async (
  duck: Duck,
  quotas: Partial<Record<Service, number>>,
  zones: Map<number, Zone>,
): Promise<void> => {
  const quotaValues = Object.entries(quotas)
    .map(([service, quota]) => `('${service}', ${String(quota)})`)
    .join(", ");
  await duck.run(`
    CREATE OR REPLACE TEMP TABLE sample_selected AS
    SELECT row_number() OVER (ORDER BY service, sample_key, pickup_at, pu_zone_id)::INTEGER AS sample_id, *
    FROM (
      SELECT c.*, row_number() OVER (
        PARTITION BY c.service ORDER BY sample_key, pickup_at, pu_zone_id, do_zone_id, fare
      ) AS rank_in_service
      FROM sample_candidates c
    ) ranked
    JOIN (VALUES ${quotaValues}) AS q(quota_service, quota) ON q.quota_service = ranked.service
    WHERE rank_in_service <= quota`);

  // Positions are computed in JS (rejection sampling in the zone polygon), seeded by the hash.
  const rows = await duck.all<{
    sample_id: number;
    pu_zone_id: number;
    seed: number;
  }>(
    "SELECT sample_id, pu_zone_id, (sample_key & 4294967295)::BIGINT AS seed FROM sample_selected",
  );
  await duck.run(
    "CREATE OR REPLACE TABLE sample_positions (sample_id INTEGER, lon DOUBLE, lat DOUBLE)",
  );
  const appender = await duck.appender("sample_positions");
  for (const row of rows) {
    const zone = zones.get(row.pu_zone_id);
    if (!zone) continue;
    const [lon, lat] = randomPointInZone(zone, row.seed);
    appender.appendInteger(row.sample_id);
    appender.appendDouble(lon);
    appender.appendDouble(lat);
    appender.endRow();
  }
  appender.closeSync();

  await duck.run("BEGIN TRANSACTION");
  await duck.run("DELETE FROM trip_sample");
  await duck.run(`
    INSERT INTO trip_sample
    SELECT s.sample_id, ${SAMPLE_COLUMNS.split(", ")
      .map((c) => `s.${c}`)
      .join(", ")}, p.lon, p.lat
    FROM sample_selected s LEFT JOIN sample_positions p USING (sample_id)
    ORDER BY s.sample_id`);
  await duck.run("COMMIT");
  await duck.run("DROP TABLE sample_positions");
};

export const tripSampleStep = createTripSampleStep();
