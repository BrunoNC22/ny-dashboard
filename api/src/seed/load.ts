import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

import type { PoolClient } from "pg";
import { from as copyFrom } from "pg-copy-streams";

import { parseZoneLookup, toBoroughId } from "../../etl/lib/zones";
import type { SnapshotManifest } from "./manifest";

const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** Columns of a table in the public schema. */
const tableColumns = async (
  client: PoolClient,
  table: string,
): Promise<Set<string>> => {
  const { rows } = await client.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [table],
  );
  return new Set(rows.map((row) => row.column_name));
};

/**
 * Streams the gzip CSV chunks of one snapshot table into `target` with COPY.
 * Fails early if a snapshot column does not exist in the database table.
 */
export const copySnapshotTable = async (
  client: PoolClient,
  dir: string,
  table: SnapshotManifest["tables"][string],
  target: string,
): Promise<number> => {
  const existing = await tableColumns(client, target);
  const columns = table.columns.map((column) => column.name);
  const unknown = columns.filter((column) => !existing.has(column));
  if (unknown.length > 0) {
    throw new Error(`Table ${target} has no column(s): ${unknown.join(", ")}`);
  }
  const sql = `COPY ${quoteIdent(target)} (${columns.map(quoteIdent).join(", ")}) FROM STDIN WITH (FORMAT csv, HEADER true)`;
  for (const file of table.files) {
    await pipeline(
      createReadStream(join(dir, file.file)),
      createGunzip(),
      client.query(copyFrom(sql)),
    );
  }
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*) AS n FROM ${quoteIdent(target)}`,
  );
  return Number(rows[0]?.n ?? 0);
};

interface ZoneFeature {
  id: number;
  properties: { centroid: [number, number] };
}

/** Inserts the 265 TLC zones (lookup + inner point from the GeoJSON; 264/265 have none). */
export const loadZones = async (
  client: PoolClient,
  zonesDir: string,
): Promise<number> => {
  const lookup = parseZoneLookup(
    await readFile(join(zonesDir, "taxi_zone_lookup.csv"), "utf8"),
  );
  const geojson = JSON.parse(
    await readFile(join(zonesDir, "taxi_zones.geojson"), "utf8"),
  ) as {
    features: ZoneFeature[];
  };
  const centroids = new Map(
    geojson.features.map((f) => [f.id, f.properties.centroid]),
  );

  const values: unknown[] = [];
  const placeholders = lookup.map((row, i) => {
    const [lon, lat] = centroids.get(row.locationId) ?? [null, null];
    values.push(
      row.locationId,
      row.zone,
      toBoroughId(row.borough),
      row.serviceZone,
      lon,
      lat,
    );
    const params = Array.from(
      { length: 6 },
      (_, k) => `$${String(i * 6 + k + 1)}`,
    );
    return `(${params.join(", ")})`;
  });
  await client.query(
    `INSERT INTO zones (id, name, borough, service_zone, centroid_lon, centroid_lat) VALUES ${placeholders.join(", ")}`,
    values,
  );
  return lookup.length;
};
