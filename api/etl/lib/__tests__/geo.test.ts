import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadZones } from "../../steps/tripSample";
import {
  bboxOf,
  mulberry32,
  pointInGeometry,
  randomPointInZone,
  type Zone,
  type ZoneGeometry,
} from "../geo";
import { ZONES_DIR } from "../paths";

// 10×10 square with a 4×4 hole in the middle
const squareWithHole: ZoneGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [3, 3],
      [7, 3],
      [7, 7],
      [3, 7],
      [3, 3],
    ],
  ],
};
const twoIslands: ZoneGeometry = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
    [
      [
        [5, 5],
        [6, 5],
        [6, 6],
        [5, 6],
        [5, 5],
      ],
    ],
  ],
};

describe("pointInGeometry", () => {
  it("handles holes", () => {
    expect(pointInGeometry(squareWithHole, [1, 1])).toBe(true);
    expect(pointInGeometry(squareWithHole, [5, 5])).toBe(false);
    expect(pointInGeometry(squareWithHole, [11, 5])).toBe(false);
  });

  it("handles multipolygons", () => {
    expect(pointInGeometry(twoIslands, [0.5, 0.5])).toBe(true);
    expect(pointInGeometry(twoIslands, [5.5, 5.5])).toBe(true);
    expect(pointInGeometry(twoIslands, [3, 3])).toBe(false);
  });

  it("computes the bounding box of all polygons", () => {
    expect(bboxOf(twoIslands)).toEqual({ minX: 0, minY: 0, maxX: 6, maxY: 6 });
  });
});

describe("randomPointInZone", () => {
  const zone: Zone = {
    geometry: squareWithHole,
    bbox: bboxOf(squareWithHole),
    centroid: [1, 1],
  };

  it("is deterministic for a seed and stays inside the polygon (outside the hole)", () => {
    const points = Array.from({ length: 500 }, (_, seed) =>
      randomPointInZone(zone, seed),
    );
    expect(
      points.every((point) => pointInGeometry(squareWithHole, point)),
    ).toBe(true);
    expect(randomPointInZone(zone, 42)).toEqual(randomPointInZone(zone, 42));
    expect(randomPointInZone(zone, 42)).not.toEqual(
      randomPointInZone(zone, 43),
    );
  });

  it("falls back to the inner point when sampling keeps failing", () => {
    const sliver: Zone = {
      ...zone,
      bbox: { minX: 20, minY: 20, maxX: 30, maxY: 30 },
    };
    expect(randomPointInZone(sliver, 1, 10)).toEqual([1, 1]);
  });

  it("produces uniform-looking floats", () => {
    const random = mulberry32(7);
    const values = Array.from({ length: 10_000 }, random);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(values.reduce((a, b) => a + b, 0) / values.length).toBeCloseTo(
      0.5,
      1,
    );
  });

  it("places points inside every real taxi zone", async () => {
    const zones = await loadZones(join(ZONES_DIR, "taxi_zones.geojson"));
    expect(zones.size).toBe(263);
    for (const [id, zone] of zones) {
      for (let seed = 0; seed < 20; seed++) {
        const point = randomPointInZone(zone, id * 1000 + seed);
        expect(
          pointInGeometry(zone.geometry, point),
          `zone ${String(id)}`,
        ).toBe(true);
      }
    }
  });
});
