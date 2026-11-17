import { describe, expect, it } from "vitest";

import { widgetConfigSchema } from "../index";
import { kpiWidget, lineWidget } from "./fixtures";

describe("widgetConfigSchema", () => {
  it("accepts valid configs of different types", () => {
    expect(widgetConfigSchema.safeParse(kpiWidget).success).toBe(true);
    expect(widgetConfigSchema.safeParse(lineWidget).success).toBe(true);
    expect(
      widgetConfigSchema.safeParse({
        id: "map-1",
        type: "map",
        title: "Mapa",
        metric: "trips",
        layers: ["choropleth", "arcs"],
        colorBy: "service",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown widget types", () => {
    expect(
      widgetConfigSchema.safeParse({ ...lineWidget, type: "gauge" }).success,
    ).toBe(false);
  });

  it("validates fields according to the widget type", () => {
    // A scatter needs `y` and `colorBy` besides `x`.
    expect(
      widgetConfigSchema.safeParse({
        id: "x",
        type: "scatter",
        title: "S",
        x: "fare",
      }).success,
    ).toBe(false);
  });

  it("requires groupBy for stacked bars only", () => {
    const stacked = { ...lineWidget, id: "stacked", type: "stacked_bar" };
    expect(widgetConfigSchema.safeParse(stacked).success).toBe(false);
    expect(
      widgetConfigSchema.safeParse({ ...stacked, groupBy: "service" }).success,
    ).toBe(true);
    expect(
      widgetConfigSchema.safeParse({ ...lineWidget, type: "bar" }).success,
    ).toBe(true);
  });

  it("requires the table sort column to be one of the columns", () => {
    const table = {
      id: "table-1",
      type: "table",
      title: "Top zonas",
      dimension: "zone",
      columns: ["trips", "revenue"],
      sortBy: "trips",
      sortDir: "desc",
      limit: 10,
    };
    expect(widgetConfigSchema.safeParse(table).success).toBe(true);
    expect(
      widgetConfigSchema.safeParse({ ...table, sortBy: "avg_fare" }).success,
    ).toBe(false);
    expect(
      widgetConfigSchema.safeParse({ ...table, columns: ["trips", "trips"] })
        .success,
    ).toBe(false);
  });

  it("rejects duplicated map layers and empty layer lists", () => {
    const map = {
      id: "m",
      type: "map",
      title: "Mapa",
      metric: "trips",
      colorBy: "service",
    };
    expect(widgetConfigSchema.safeParse({ ...map, layers: [] }).success).toBe(
      false,
    );
    expect(
      widgetConfigSchema.safeParse({ ...map, layers: ["points", "points"] })
        .success,
    ).toBe(false);
  });

  it("accepts per-widget filter overrides, including zones", () => {
    const result = widgetConfigSchema.safeParse({
      ...lineWidget,
      filters: { services: ["yellow"], zones: [132, 138] },
    });
    expect(result.success).toBe(true);
  });

  it("validates widget ids and trims titles", () => {
    expect(
      widgetConfigSchema.safeParse({ ...kpiWidget, id: "has space" }).success,
    ).toBe(false);
    expect(
      widgetConfigSchema.safeParse({ ...kpiWidget, title: "   " }).success,
    ).toBe(false);
    const parsed = widgetConfigSchema.parse({
      ...kpiWidget,
      title: "  Corridas  ",
    });
    expect(parsed.title).toBe("Corridas");
  });
});
