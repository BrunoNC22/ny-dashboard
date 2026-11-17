import { DEFAULT_GLOBAL_FILTERS, type MapResponse } from "@ny-dashboard/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ZoneFeature } from "../api/client";
import { MapLegend } from "../widgets/map/MapLegend";
import { zoneTooltip } from "../widgets/map/tooltip";
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
