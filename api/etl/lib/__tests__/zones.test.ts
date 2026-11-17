import { describe, expect, it } from "vitest";

import {
  buildZones,
  type FeatureCollection,
  parseCsvLine,
  parseZoneLookup,
  toBoroughId,
  type ZoneLookupRow,
} from "../zones";

const square = (lon: number, lat: number, size = 0.01) => ({
  type: "Polygon",
  coordinates: [
    [
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat],
    ],
  ],
});

const lookup: ZoneLookupRow[] = [
  { locationId: 1, borough: "EWR", zone: "Newark Airport", serviceZone: "EWR" },
  {
    locationId: 2,
    borough: "Staten Island",
    zone: "Arden Heights",
    serviceZone: "Boro Zone",
  },
  { locationId: 264, borough: "Unknown", zone: "N/A", serviceZone: "N/A" },
  {
    locationId: 265,
    borough: "N/A",
    zone: "Outside of NYC",
    serviceZone: "N/A",
  },
];

const polygons = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: square(-74.2, 40.55),
      properties: { LocationID: 2, zone: "Arden Heights" },
    },
    {
      type: "Feature",
      geometry: square(-74.18, 40.69),
      properties: { LocationID: 1, zone: "Newark Airport" },
    },
  ],
});

const points = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-74.195, 40.555] },
      properties: { LocationID: 2 },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-74.175, 40.695] },
      properties: { LocationID: 1 },
    },
  ],
});

describe("parseCsvLine", () => {
  it("handles quoted fields, commas inside quotes and escaped quotes", () => {
    expect(parseCsvLine('1,"EWR","Newark Airport","EWR"')).toEqual([
      "1",
      "EWR",
      "Newark Airport",
      "EWR",
    ]);
    expect(parseCsvLine('7,"A, B","say ""hi""",')).toEqual([
      "7",
      "A, B",
      'say "hi"',
      "",
    ]);
  });
});

describe("parseZoneLookup", () => {
  it("parses the official format", () => {
    const csv =
      '"LocationID","Borough","Zone","service_zone"\r\n' +
      '1,"EWR","Newark Airport","EWR"\r\n' +
      '132,"Queens","JFK Airport","Airports"\r\n';
    expect(parseZoneLookup(csv)).toEqual([
      {
        locationId: 1,
        borough: "EWR",
        zone: "Newark Airport",
        serviceZone: "EWR",
      },
      {
        locationId: 132,
        borough: "Queens",
        zone: "JFK Airport",
        serviceZone: "Airports",
      },
    ]);
  });

  it("rejects unexpected headers and malformed lines", () => {
    expect(() => parseZoneLookup('"id","name"\n1,"x"')).toThrow(/header/);
    expect(() =>
      parseZoneLookup(
        '"LocationID","Borough","Zone","service_zone"\nabc,"Queens","X","Y"',
      ),
    ).toThrow(/Invalid lookup line 2/);
  });
});

describe("toBoroughId", () => {
  it("maps TLC borough names to shared ids", () => {
    expect(toBoroughId("Manhattan")).toBe("manhattan");
    expect(toBoroughId("Staten Island")).toBe("staten_island");
    expect(toBoroughId("EWR")).toBe("ewr");
    expect(toBoroughId("Unknown")).toBe("unknown");
    expect(toBoroughId("N/A")).toBe("unknown");
  });
});

describe("buildZones", () => {
  it("merges polygons, inner points and lookup, sorted by id", () => {
    const { zones, warnings } = buildZones(polygons(), points(), lookup);
    expect(warnings).toEqual([]);
    expect(zones.features.map((feature) => feature.id)).toEqual([1, 2]);
    expect(zones.features[1]?.properties).toEqual({
      locationId: 2,
      zone: "Arden Heights",
      borough: "Staten Island",
      boroughId: "staten_island",
      serviceZone: "Boro Zone",
      centroid: [-74.195, 40.555],
    });
  });

  it("uses lookup names and warns when the shapefile disagrees", () => {
    const input = polygons();
    const first = input.features[0];
    if (first) first.properties.zone = "Old Name";
    const { zones, warnings } = buildZones(input, points(), lookup);
    expect(warnings).toEqual([
      'LocationID 2: shapefile zone "Old Name" ≠ lookup "Arden Heights"',
    ]);
    expect(zones.features[1]?.properties.zone).toBe("Arden Heights");
  });

  it("fails when a lookup zone has no geometry (except 264/265)", () => {
    const input = polygons();
    input.features.pop();
    expect(() => buildZones(input, points(), lookup)).toThrow(
      "Zones without geometry: 1",
    );
  });

  it("fails on duplicated geometries", () => {
    const input = polygons();
    const first = input.features[0];
    if (first) input.features.push(first);
    expect(() => buildZones(input, points(), lookup)).toThrow(
      /Duplicate geometry for LocationID 2/,
    );
  });

  it("fails when a coordinate is outside NYC (bad reprojection)", () => {
    const input = polygons();
    const first = input.features[0];
    if (first) first.geometry = square(1000000, 200000);
    expect(() => buildZones(input, points(), lookup)).toThrow(/outside NYC/);
  });

  it("fails when an inner point is missing", () => {
    const pts = points();
    pts.features.pop();
    expect(() => buildZones(polygons(), pts, lookup)).toThrow(
      /Missing inner point for LocationID 1/,
    );
  });
});
