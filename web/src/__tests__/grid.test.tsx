import { createDefaultDashboard } from "@ny-dashboard/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DashboardGrid } from "../components/grid/DashboardGrid";
import {
  breakpointForWidth,
  fromGridLayout,
  toGridLayouts,
} from "../components/grid/gridConfig";
import { useDashboardStore } from "../stores/dashboardStore";

beforeEach(() => {
  useDashboardStore.getState().hydrate(createDefaultDashboard());
});

describe("grid config", () => {
  it("uses desktop from 768px and mobile below", () => {
    expect(breakpointForWidth(768)).toBe("desktop");
    expect(breakpointForWidth(767)).toBe("mobile");
    expect(breakpointForWidth(360)).toBe("mobile");
  });

  it("round-trips store layouts through RGL layouts with per-type min sizes", () => {
    const state = createDefaultDashboard();
    const { layouts } = state;
    const grid = toGridLayouts(state);
    const kpi = grid.desktop.find((i) => i.i === "kpi-trips");
    const map = grid.mobile.find((i) => i.i === "map-zones");
    expect(kpi).toMatchObject({ minW: 2, minH: 3 });
    expect(map).toMatchObject({ minW: 2, minH: 6 });
    expect(fromGridLayout(grid.desktop)).toEqual(layouts.desktop);
    expect(fromGridLayout(grid.mobile)).toEqual(layouts.mobile);
  });
});

describe("DashboardGrid", () => {
  it.each([
    [1280, "desktop"],
    [390, "mobile"],
  ] as const)(
    "renders every widget at %ipx with the %s breakpoint",
    (width, expected) => {
      const seen = new Set<string>();
      render(
        <DashboardGrid
          width={width}
          renderWidget={(widget, breakpoint) => {
            seen.add(breakpoint);
            return <span>{widget.title}</span>;
          }}
        />,
      );
      for (const widget of createDefaultDashboard().widgets) {
        expect(
          document.querySelector(`[data-widget-id="${widget.id}"]`),
        ).not.toBeNull();
      }
      expect(screen.getByText("Receita")).toBeInTheDocument();
      expect([...seen]).toEqual([expected]);
    },
  );

  it("mounting does not mark the dashboard as edited", () => {
    render(<DashboardGrid width={1280} renderWidget={(w) => w.title} />);
    expect(useDashboardStore.getState()).toMatchObject({
      dirty: false,
      past: [],
    });
  });
});
