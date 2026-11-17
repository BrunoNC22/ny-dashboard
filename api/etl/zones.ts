/**
 * Builds the taxi zones GeoJSON used by the map and by the trip sample positions.
 *
 *   pnpm --filter @ny-dashboard/api etl:zones [--refresh]
 *
 * Input:  official TLC taxi_zones.zip (shapefile, EPSG:2263) + taxi_zone_lookup.csv
 * Output: api/data/zones/taxi_zones.geojson (WGS84, simplified) + taxi_zone_lookup.csv
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import mapshaper from "mapshaper";

import { downloadToCache } from "./lib/download";
import { ZONES_DIR } from "./lib/paths";
import {
  buildZones,
  type FeatureCollection,
  parseZoneLookup,
} from "./lib/zones";

const ZONES_URL = "https://d37ci6vzurychx.cloudfront.net/misc/taxi_zones.zip";
const LOOKUP_URL =
  "https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv";

/** Percentage of vertices kept by mapshaper (topology-preserving). See CLAUDE.md §13. */
const SIMPLIFY = "15%";
/** ~1 m precision. */
const PRECISION = "0.00001";
const MAX_BYTES = 1024 * 1024;

const asText = (
  content: string | Uint8Array | undefined,
  name: string,
): string => {
  if (content === undefined)
    throw new Error(`mapshaper did not produce ${name}`);
  return typeof content === "string"
    ? content
    : Buffer.from(content).toString("utf8");
};

const main = async (): Promise<void> => {
  const refresh = process.argv.includes("--refresh");
  const zipPath = await downloadToCache(ZONES_URL, { refresh });
  const lookupPath = await downloadToCache(LOOKUP_URL, { refresh });

  const polygonsOut = await mapshaper.applyCommands(
    `-i taxi_zones.zip -proj wgs84 -simplify ${SIMPLIFY} weighted keep-shapes ` +
      `-filter-fields LocationID,zone -o format=geojson precision=${PRECISION} polygons.json`,
    { "taxi_zones.zip": await readFile(zipPath) },
  );
  const polygonsJson = asText(polygonsOut["polygons.json"], "polygons.json");

  const pointsOut = await mapshaper.applyCommands(
    `-i polygons.json -points inner -o format=geojson precision=${PRECISION} points.json`,
    { "polygons.json": polygonsJson },
  );
  const pointsJson = asText(pointsOut["points.json"], "points.json");

  const lookup = parseZoneLookup(await readFile(lookupPath, "utf8"));
  const { zones, warnings } = buildZones(
    JSON.parse(polygonsJson) as FeatureCollection,
    JSON.parse(pointsJson) as FeatureCollection,
    lookup,
  );
  for (const warning of warnings) console.warn(`warning    ${warning}`);

  const output = JSON.stringify(zones);
  if (output.length > MAX_BYTES) {
    throw new Error(
      `GeoJSON too large: ${String(output.length)} bytes (max ${String(MAX_BYTES)})`,
    );
  }

  await mkdir(ZONES_DIR, { recursive: true });
  await writeFile(join(ZONES_DIR, "taxi_zones.geojson"), output);
  await copyFile(lookupPath, join(ZONES_DIR, "taxi_zone_lookup.csv"));
  console.log(
    `wrote      taxi_zones.geojson (${String(zones.features.length)} zones, ${(output.length / 1024).toFixed(0)} KB) + taxi_zone_lookup.csv`,
  );
};

await main();
