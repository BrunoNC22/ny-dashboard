import {
  DEFAULT_GLOBAL_FILTERS,
  type TripsResponse,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { Chart, Plugin } from "chart.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { getChartTheme } from "../charts/chartTheme";
import { resolveWidgetFilters } from "../widgets/resolveFilters";
import { renderTimer, sampleChartConfig } from "../widgets/sample/sampleChart";
import {
  bubbleRadius,
  HOVER_LIMIT,
  sampleNotice,
  type SampleWidget,
  toSampleDatasets,
  toTripsRequest,
} from "../widgets/sample/transform";
import { ScatterWidget } from "../widgets/sample/TripSampleWidget";

vi.mock("react-chartjs-2", () => ({
  Chart: (props: { type: string; data: { datasets: { label: string }[] } }) => (
    <div data-testid="chart" data-type={props.type}>
      {props.data.datasets.map((d) => d.label).join(" | ")}
    </div>
  ),
}));

const filters = resolveWidgetFilters(DEFAULT_GLOBAL_FILTERS, { zones: [132] });
const scatter: SampleWidget = {
  id: "s",
  type: "scatter",
  title: "Distância × tarifa",
  x: "distance",
  y: "fare",
  colorBy: "company",
};

const response: TripsResponse = {
  categories: ["yellow", "uber", "lyft", "green"],
  columns: {
    x: [1, 2, 3, 4, 5],
    y: [10, 20, 30, 40, 50],
    r: [0, 4, 16, 0, 1],
    category: [0, 1, 1, 2, 3],
  },
};

describe("request and notices", () => {
  it("drops the comparison and sends r only for bubbles", () => {
    expect(toTripsRequest(scatter, filters)).toEqual({
      x: "distance",
      y: "fare",
      colorBy: "company",
      filters: {
        period: filters.period,
        services: [],
        companies: [],
        boroughs: [],
        zones: [132],
      },
    });
    expect(
      toTripsRequest({ ...scatter, type: "bubble", r: "tips" }, filters),
    ).toMatchObject({ r: "tips" });
  });

  it("warns when the period misses the sample month", () => {
    expect(sampleNotice(filters, "2026-09")).toBeNull();
    expect(
      sampleNotice(
        { ...filters, period: { from: "2026-07-01", to: "2026-07-31" } },
        "2026-09",
      ),
    ).toMatch(/cobre só 09\/2026/);
  });
});

describe("datasets", () => {
  it("groups by category in the fixed entity order, with a shape per slot", () => {
    const datasets = toSampleDatasets(response, "company");
    expect(datasets.map((d) => [d.label, d.slot, d.points.length])).toEqual([
      ["Uber", 0, 2],
      ["Lyft", 1, 1],
      ["Yellow", 2, 1],
      ["Green", 3, 1],
    ]);
    expect(new Set(datasets.map((d) => d.pointStyle)).size).toBe(4);
  });

  it("sorts points by x (Chart.js assumes it with parsing: false)", () => {
    const shuffled: TripsResponse = {
      categories: ["uber"],
      columns: { x: [5, 1, 3], y: [50, 10, 30], r: null, category: [0, 0, 0] },
    };
    const [uber] = toSampleDatasets(shuffled, "company");
    expect(uber?.points).toEqual([
      { x: 1, y: 10 },
      { x: 3, y: 30 },
      { x: 5, y: 50 },
    ]);
  });

  it("scales bubble radius by the square root (area ∝ value)", () => {
    expect(bubbleRadius(16, 16)).toBe(12);
    expect(bubbleRadius(4, 16)).toBe(6);
    expect(bubbleRadius(0, 16)).toBe(1);
  });
});

describe("chart config", () => {
  const theme = getChartTheme("dark", "forest");

  it("bubbles keep Chart.js parsing so the radius is read", () => {
    const bubble = sampleChartConfig(toSampleDatasets(response, "company"), {
      type: "bubble",
      theme,
      x: "distance",
      y: "fare",
      r: "tips",
    });
    expect(bubble.options).not.toHaveProperty("parsing");
    expect(bubble.data.datasets[0]?.data[0]).toHaveProperty("r");
  });

  it("never animates or parses, and turns hover off for huge samples", () => {
    const small = sampleChartConfig(toSampleDatasets(response, "company"), {
      type: "scatter",
      theme,
      x: "distance",
      y: "fare",
    });
    expect(small.options).toMatchObject({ animation: false, parsing: false });
    expect(small.hover).toBe(true);

    const many = Array.from({ length: HOVER_LIMIT + 1 }, (_, i) => ({
      x: i,
      y: i,
    }));
    const big = sampleChartConfig(
      [
        {
          key: "uber",
          label: "Uber",
          slot: 0,
          pointStyle: "circle",
          points: many,
        },
      ],
      { type: "scatter", theme, x: "distance", y: "fare" },
    );
    expect(big.hover).toBe(false);
    expect(big.options).toMatchObject({
      events: [],
      plugins: { tooltip: { enabled: false } },
    });
  });

  it("measures the first draw once", () => {
    const onMeasured = vi.fn();
    const plugin = renderTimer(onMeasured) as Plugin & {
      beforeInit: (chart: Chart) => void;
      afterRender: (chart: Chart) => void;
    };
    const chart = {} as Chart;
    plugin.beforeInit(chart);
    plugin.afterRender(chart);
    plugin.afterRender(chart);
    expect(onMeasured).toHaveBeenCalledOnce();
  });
});

describe("ScatterWidget", () => {
  let body: TripsResponse;
  beforeEach(() => {
    body = response;
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderWidget = () =>
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ScatterWidget
          widget={scatter}
          filters={filters}
          breakpoint="desktop"
        />
      </QueryClientProvider>,
    );

  it("shows the point count, the legend counts and the approximate-position note", async () => {
    renderWidget();
    expect(await screen.findByTestId("chart")).toHaveTextContent(
      "Uber (2) | Lyft (1) | Yellow (1) | Green (1)",
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/Posição aproximada/)).toBeInTheDocument();
  });

  it("is empty when no sampled trip matches", async () => {
    body = { categories: [], columns: { x: [], y: [], r: null, category: [] } };
    renderWidget();
    expect(await screen.findByText("Sem dados")).toBeInTheDocument();
  });
});
