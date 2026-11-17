/** Minimal GeoJSON geometry helpers for the trip sample positions (no external deps). */

export type Position = [number, number];
type Ring = Position[];

export interface ZoneGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: Ring[] | Ring[][];
}

const polygonsOf = (geometry: ZoneGeometry): Ring[][] =>
  geometry.type === "Polygon"
    ? [geometry.coordinates as Ring[]]
    : (geometry.coordinates as Ring[][]);

/** Ray casting with the even-odd rule over every ring (holes are handled naturally). */
export const pointInGeometry = (
  geometry: ZoneGeometry,
  [x, y]: Position,
): boolean => {
  let inside = false;
  for (const polygon of polygonsOf(geometry)) {
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i] ?? [0, 0];
        const [xj, yj] = ring[j] ?? [0, 0];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
    }
  }
  return inside;
};

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const bboxOf = (geometry: ZoneGeometry): BBox => {
  const box = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const polygon of polygonsOf(geometry)) {
    for (const [x, y] of polygon[0] ?? []) {
      box.minX = Math.min(box.minX, x);
      box.minY = Math.min(box.minY, y);
      box.maxX = Math.max(box.maxX, x);
      box.maxY = Math.max(box.maxY, y);
    }
  }
  return box;
};

/** mulberry32: small, fast, deterministic PRNG returning floats in [0, 1). */
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export interface Zone {
  geometry: ZoneGeometry;
  bbox: BBox;
  /** Point guaranteed to be inside the zone (fallback). */
  centroid: Position;
}

/**
 * Deterministic random point inside the zone (rejection sampling in the bounding box).
 * Falls back to the zone's inner point if no candidate is accepted after `maxAttempts`.
 */
export const randomPointInZone = (
  zone: Zone,
  seed: number,
  maxAttempts = 1000,
): Position => {
  const random = mulberry32(seed);
  const { minX, minY, maxX, maxY } = zone.bbox;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const point: Position = [
      minX + random() * (maxX - minX),
      minY + random() * (maxY - minY),
    ];
    if (pointInGeometry(zone.geometry, point)) return point;
  }
  return zone.centroid;
};
