import { describe, expect, it } from "vitest";

import {
  BREAKPOINTS,
  createDefaultDashboard,
  dashboardStateSchema,
  DATA_COVERAGE,
  GRID_COLUMNS,
  type GridItem,
} from "../index";

const overlaps = (a: GridItem, b: GridItem) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("default dashboard", () => {
  it("is a valid dashboard state", () => {
    const result = dashboardStateSchema.safeParse(createDefaultDashboard());
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it("starts on the last month with data compared to the previous one", () => {
    const { filters } = createDefaultDashboard();
    expect(filters.period).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(filters.comparison).toEqual({ mode: "previous_period" });
  });

  it.each(BREAKPOINTS)("has no overlapping widgets on %s", (breakpoint) => {
    const items = createDefaultDashboard().layouts[breakpoint];
    for (const [index, item] of items.entries()) {
      for (const other of items.slice(index + 1)) {
        expect(overlaps(item, other), `${item.i} × ${other.i}`).toBe(false);
      }
      expect(item.x + item.w).toBeLessThanOrEqual(GRID_COLUMNS[breakpoint]);
    }
  });

  it("covers the showcase widget types", () => {
    const types = new Set(
      createDefaultDashboard().widgets.map((widget) => widget.type),
    );
    for (const type of [
      "kpi",
      "line",
      "area",
      "doughnut",
      "radar",
      "map",
      "table",
      "scatter",
    ]) {
      expect(types.has(type as never), type).toBe(true);
    }
  });

  it("keeps the trip sample light by filtering the scatter to JFK pickups", () => {
    const scatter = createDefaultDashboard().widgets.find(
      (widget) => widget.type === "scatter",
    );
    expect(scatter?.filters?.zones).toEqual([132]);
  });

  it("returns independent copies", () => {
    const a = createDefaultDashboard();
    a.widgets.pop();
    a.filters.services.push("yellow");
    const b = createDefaultDashboard();
    expect(b.widgets).toHaveLength(14);
    expect(b.filters.services).toEqual([]);
  });

  it("has a consistent data coverage", () => {
    expect(DATA_COVERAGE.lastMonth.to).toBe(DATA_COVERAGE.period.to);
    expect(DATA_COVERAGE.sampleMonth).toBe(
      DATA_COVERAGE.lastMonth.from.slice(0, 7),
    );
  });
});
