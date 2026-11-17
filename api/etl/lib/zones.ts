import { type Borough, boroughSchema } from "@ny-dashboard/shared";

// ── Lookup CSV ─────────────────────────────────────────────────────────────────

export interface ZoneLookupRow {
  locationId: number;
  borough: string;
  zone: string;
  serviceZone: string;
}

/** Splits one CSV line, honoring double quotes and escaped quotes (`""`). */
export const parseCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);
    if (quoted) {
      if (char === '"' && line.charAt(i + 1) === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
};

/** Parses the official `taxi_zone_lookup.csv`. */
export const parseZoneLookup = (csv: string): ZoneLookupRow[] => {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  if (header === undefined) throw new Error("Empty lookup CSV");
  const expected = ["LocationID", "Borough", "Zone", "service_zone"];
  if (parseCsvLine(header).join() !== expected.join()) {
    throw new Error(`Unexpected lookup header: ${header}`);
  }
  return lines.map((line, index) => {
    const [id, borough, zone, serviceZone] = parseCsvLine(line);
    const locationId = Number(id);
    if (
      !Number.isInteger(locationId) ||
      borough === undefined ||
      zone === undefined ||
      serviceZone === undefined
    ) {
      throw new Error(`Invalid lookup line ${String(index + 2)}: ${line}`);
    }
    return { locationId, borough, zone, serviceZone };
  });
};

/** TLC borough name → shared borough id. "Unknown"/"N/A" → "unknown". */
export const toBoroughId = (borough: string): Borough => {
  const slug = borough.trim().toLowerCase().replace(/\s+/g, "_");
  const parsed = boroughSchema.safeParse(slug);
  return parsed.success ? parsed.data : "unknown";
};

/** Lookup ids without geometry in the shapefile ("Unknown" and "Outside of NYC"). */
export const ZONES_WITHOUT_GEOMETRY = new Set([264, 265]);

// ── GeoJSON ────────────────────────────────────────────────────────────────────

type Position = number[];
interface Geometry {
  type: string;
  coordinates: unknown;
}
interface Feature<G = Geometry, P = Record<string, unknown>> {
  type: "Feature";
  id?: number;
  geometry: G;
  properties: P;
}
export interface FeatureCollection<G = Geometry, P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}

export interface ZoneProperties {
  locationId: number;
  zone: string;
  /** TLC borough name, e.g. "Staten Island". */
  borough: string;
  /** Shared borough id, e.g. "staten_island". */
  boroughId: Borough;
  /** "Yellow Zone", "Boro Zone", "Airports" or "EWR". */
  serviceZone: string;
  /** Point guaranteed to be inside the polygon [lon, lat] (used by bubbles and arcs). */
  centroid: [number, number];
}

/** Rough NYC bounding box (lon/lat) used to sanity-check the reprojection. */
export const NYC_BBOX = {
  minLon: -74.3,
  maxLon: -73.65,
  minLat: 40.45,
  maxLat: 40.95,
};

const forEachPosition = (
  coordinates: unknown,
  visit: (position: Position) => void,
): void => {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === "number") {
    visit(coordinates as Position);
    return;
  }
  for (const child of coordinates) forEachPosition(child, visit);
};

const insideNyc = ([lon, lat]: Position): boolean =>
  lon !== undefined &&
  lat !== undefined &&
  lon >= NYC_BBOX.minLon &&
  lon <= NYC_BBOX.maxLon &&
  lat >= NYC_BBOX.minLat &&
  lat <= NYC_BBOX.maxLat;

const readLocationId = (properties: Record<string, unknown>): number => {
  const value = properties.LocationID;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(
      `Feature without a valid LocationID: ${JSON.stringify(properties)}`,
    );
  }
  return value;
};

/**
 * Merges simplified polygons, inner points and the lookup into the final zones GeoJSON,
 * validating that every lookup zone (except 264/265) has exactly one geometry inside NYC.
 * Names/boroughs come from the lookup (source of truth); mismatches are reported as warnings.
 */
export const buildZones = (
  polygons: FeatureCollection,
  innerPoints: FeatureCollection,
  lookup: ZoneLookupRow[],
): {
  zones: FeatureCollection<Geometry, ZoneProperties>;
  warnings: string[];
} => {
  const warnings: string[] = [];
  const lookupById = new Map(lookup.map((row) => [row.locationId, row]));

  const centroids = new Map<number, [number, number]>();
  for (const point of innerPoints.features) {
    const [lon, lat] = point.geometry.coordinates as Position;
    if (lon === undefined || lat === undefined) continue;
    centroids.set(readLocationId(point.properties), [lon, lat]);
  }

  const seen = new Set<number>();
  const features = polygons.features.map(
    (feature): Feature<Geometry, ZoneProperties> => {
      const locationId = readLocationId(feature.properties);
      if (seen.has(locationId))
        throw new Error(
          `Duplicate geometry for LocationID ${String(locationId)}`,
        );
      seen.add(locationId);

      const row = lookupById.get(locationId);
      if (!row)
        throw new Error(
          `LocationID ${String(locationId)} is not in the lookup`,
        );
      if (feature.properties.zone !== row.zone) {
        warnings.push(
          `LocationID ${String(locationId)}: shapefile zone "${String(feature.properties.zone)}" ≠ lookup "${row.zone}"`,
        );
      }

      forEachPosition(feature.geometry.coordinates, (position) => {
        if (!insideNyc(position)) {
          throw new Error(
            `LocationID ${String(locationId)} has a coordinate outside NYC: ${JSON.stringify(position)}`,
          );
        }
      });

      const centroid = centroids.get(locationId);
      if (!centroid)
        throw new Error(
          `Missing inner point for LocationID ${String(locationId)}`,
        );

      return {
        type: "Feature",
        id: locationId,
        geometry: feature.geometry,
        properties: {
          locationId,
          zone: row.zone,
          borough: row.borough,
          boroughId: toBoroughId(row.borough),
          serviceZone: row.serviceZone,
          centroid,
        },
      };
    },
  );

  const missing = lookup
    .map((row) => row.locationId)
    .filter((id) => !ZONES_WITHOUT_GEOMETRY.has(id) && !seen.has(id));
  if (missing.length > 0)
    throw new Error(`Zones without geometry: ${missing.join(", ")}`);

  features.sort((a, b) => a.properties.locationId - b.properties.locationId);
  return { zones: { type: "FeatureCollection", features }, warnings };
};
