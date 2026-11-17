import { DEFAULT_GLOBAL_FILTERS, type MapResponse } from "@ny-dashboard/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ZoneFeature } from "../api/client";
import { MapLegend, PointsLegend } from "../widgets/map/MapLegend";
import {
  arcWidth,
  positionAt,
  toFlows,
  toFlowsRequest,
  toPointColumns,
  toPointsRequest,
  usesFlows,
  usesSample,
} from "../widgets/map/sampleLayers";
import { flowTooltip, zoneTooltip } from "../widgets/map/tooltip";
import {
  bubbleRadius,
  isComparing,
  type MapWidget,
  maxValue,
  toZonesRequest,
  usesZoneValues,
  zoneValues,
} from "../widgets/map/transform";
import { resolveWidgetFilters } from "../widgets/resolveFilters";

type ZonesResponse = Extract<MapResponse, { mode: "zones" }>;

const widget: MapWidget = {
  id: "m",
  type: "map",
  title: "Corridas por zona",
  metric: "trips",
  layers: ["choropleth"],
  colorBy: "service",
};
const filters = resolveWidgetFilters(DEFAULT_GLOBAL_FILTERS, undefined);

const response = (compared: boolean): ZonesResponse => ({
  mode: "zones",
  metric: "trips",
  notApplicable: false,
  comparisonRange: compared ? { from: "2026-08-01", to: "2026-08-31" } : null,
  columns: {
    zoneId: [132, 138, 1],
    value: [900, 400, null],
    comparisonValue: compared ? [800, 500, null] : null,
    deltaPct: compared ? [12.5, -20, null] : null,
  },
});

const jfk: ZoneFeature = {
  type: "Feature",
  id: 132,
  geometry: { type: "Polygon", coordinates: [] },
  properties: {
    locationId: 132,
    zone: "JFK Airport",
    borough: "Queens",
    boroughId: "queens",
    serviceZone: "Airports",
    centroid: [-73.78, 40.64],
  },
};

describe("map transform", () => {
  it("asks for zone values only for zone layers", () => {
    expect(usesZoneValues(widget)).toBe(true);
    expect(usesZoneValues({ ...widget, layers: ["points", "heatmap"] })).toBe(
      false,
    );
    expect(toZonesRequest(widget, filters)).toMatchObject({
      mode: "zones",
      metric: "trips",
      comparison: { mode: "previous_period" },
    });
  });

  it("reads the columns per zone and knows when it compares", () => {
    const values = zoneValues(response(true));
    expect(values.get(138)).toEqual({
      value: 400,
      comparisonValue: 500,
      deltaPct: -20,
    });
    expect(isComparing(response(true))).toBe(true);
    expect(isComparing(response(false))).toBe(false);
    expect(maxValue(values.values())).toBe(900);
  });

  it("scales bubbles by area", () => {
    expect(bubbleRadius(900, 900)).toBe(28);
    expect(bubbleRadius(225, 900)).toBe(14);
    expect(bubbleRadius(null, 900)).toBe(0);
  });
});

describe("zone tooltip", () => {
  it("shows zone, borough, value and the change in words", () => {
    const values = zoneValues(response(true));
    const tip = zoneTooltip(jfk, values, {
      metric: "trips",
      comparing: true,
      direction: "higher_is_better",
    });
    expect(tip.html).toContain("JFK Airport");
    expect(tip.html).toContain("Queens");
    expect(tip.html).toContain("900");
    expect(tip.html).toContain("+12,5% melhorou");
  });

  it("reads the change by the metric direction and escapes names", () => {
    const values = zoneValues(response(true));
    const tip = zoneTooltip(
      { ...jfk, properties: { ...jfk.properties, zone: "<b>JFK</b>" } },
      values,
      { metric: "avg_wait", comparing: true, direction: "lower_is_better" },
    );
    expect(tip.html).toContain("piorou");
    expect(tip.html).not.toContain("<b>JFK</b>");
  });
});

describe("map legend", () => {
  it("sequential shows the quantile range", () => {
    render(
      <MapLegend
        mode="sequential"
        theme="dark"
        colors={["#111", "#222"]}
        min="15 mil"
        max="176 mil"
      />,
    );
    expect(screen.getByText("≤ 15 mil")).toBeInTheDocument();
    expect(screen.getByText("classes por quantil")).toBeInTheDocument();
  });

  it("diverging says worse / better", () => {
    render(
      <MapLegend mode="diverging" theme="light" colors={[]} min="" max="" />,
    );
    expect(screen.getByText("piora")).toBeInTheDocument();
    expect(screen.getByText("melhora")).toBeInTheDocument();
  });

  it("bubbles explain that the area encodes the value", () => {
    render(
      <MapLegend
        mode="size"
        theme="light"
        colors={[]}
        min=""
        max="US$ 6,4 mi"
        metricLabel="Receita"
      />,
    );
    expect(
      screen.getByText(/área ∝ receita · maior: US\$ 6,4 mi/),
    ).toBeInTheDocument();
  });
});

describe("sample layers and flows", () => {
  it("turns the points columns into typed arrays with a shape per company", () => {
    const columns = toPointColumns(
      {
        mode: "points",
        categories: ["yellow", "uber", "lyft", "green"],
        columns: {
          lon: [-73.9, -73.8, -73.7, -73.95, -74],
          lat: [40.7, 40.6, 40.65, 40.75, 40.8],
          category: [0, 1, 1, 2, 3],
        },
      },
      "company",
    );
    expect(columns.length).toBe(5);
    expect(columns.positions).toBeInstanceOf(Float32Array);
    expect(positionAt(columns, 1)).toEqual([
      Math.fround(-73.8),
      Math.fround(40.6),
    ]);
    expect(
      columns.categories.map((c) => [c.label, c.slot, c.shape, c.count]),
    ).toEqual([
      ["Yellow", 2, "triangle", 1],
      ["Uber", 0, "circle", 2],
      ["Lyft", 1, "square", 1],
      ["Green", 3, "diamond", 1],
    ]);
  });

  it("keeps routes with both ends on the map and different zones", () => {
    const zones = new Map([
      [132, { centroid: [-73.78, 40.64] as [number, number], name: "JFK" }],
      [161, { centroid: [-73.98, 40.76] as [number, number], name: "Midtown" }],
    ]);
    const flows = toFlows(
      {
        mode: "flows",
        metric: "trips",
        notApplicable: false,
        columns: {
          from: [132, 132, 76],
          to: [161, 132, 161],
          value: [900, 500, 300],
        },
      },
      zones,
    );
    expect(flows).toEqual([
      {
        from: [-73.78, 40.64],
        to: [-73.98, 40.76],
        fromName: "JFK",
        toName: "Midtown",
        value: 900,
      },
    ]);
    expect(arcWidth(900, 900)).toBe(8);
    expect(arcWidth(1, 900)).toBe(1);
  });

  it("asks for the sample or the flows only when a layer needs them", () => {
    expect(usesSample({ ...widget, layers: ["choropleth"] })).toBe(false);
    expect(usesSample({ ...widget, layers: ["hexagon"] })).toBe(true);
    expect(usesFlows({ ...widget, layers: ["arcs"] })).toBe(true);
    expect(toPointsRequest(widget, filters)).not.toHaveProperty("comparison");
    expect(toFlowsRequest(widget, filters)).toMatchObject({
      mode: "flows",
      limit: 150,
    });
  });

  it("arc tooltip names both ends", () => {
    const tip = flowTooltip(
      { fromName: "JFK Airport", toName: "Midtown", value: 900 },
      "trips",
    );
    expect(tip.html).toContain("JFK Airport → Midtown");
    expect(tip.html).toContain("900");
  });

  it("points legend shows shape, name and count per category", () => {
    render(
      <PointsLegend
        categories={[
          {
            key: "lyft",
            label: "Lyft",
            slot: 1,
            shape: "square",
            count: 207_600,
          },
          {
            key: "uber",
            label: "Uber",
            slot: 0,
            shape: "circle",
            count: 572_100,
          },
        ]}
        colors={[
          [1, 2, 3, 255],
          [4, 5, 6, 255],
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Uber572,1 mil");
    expect(items[1]).toHaveTextContent("Lyft207,6 mil");
  });
});
