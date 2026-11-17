import {
  createDefaultDashboard,
  DEFAULT_GLOBAL_FILTERS,
  type TimeseriesResponse,
  type WidgetConfigOf,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { getChartTheme } from "../charts/chartTheme";
import { ANIMATION_MS } from "../styles/motion";
import { resolveWidgetFilters } from "../widgets/resolveFilters";
import { seriesChartConfig } from "../widgets/series/seriesChart";
import { TimeSeriesWidget } from "../widgets/series/TimeSeriesWidget";
import {
  alignmentOffset,
  buildDatasets,
  projectionDeviations,
  type SeriesWidget,
  toMillis,
  toPoints,
  toSeriesQuery,
} from "../widgets/series/transform";

vi.mock("react-chartjs-2", () => ({
  Chart: (props: { type: string; data: { datasets: { label: string }[] } }) => (
    <div data-testid="chart" data-type={props.type}>
      {props.data.datasets.map((d) => d.label).join(" | ")}
    </div>
  ),
}));

const line = createDefaultDashboard().widgets.find(
  (w) => w.id === "area-revenue-mom",
) as WidgetConfigOf<"area">;
const filters = resolveWidgetFilters(DEFAULT_GLOBAL_FILTERS, undefined);
const days = (from: number, n: number, month = "09") =>
  Array.from(
    { length: n },
    (_, i) => `2026-${month}-${String(from + i).padStart(2, "0")}`,
  );

const response = (
  patch: Partial<TimeseriesResponse> = {},
): TimeseriesResponse => ({
  metric: "revenue",
  granularity: "day",
  unit: "usd",
  notices: [],
  notApplicable: false,
  series: [{ key: "total", points: { t: days(1, 3), v: [10, 20, 30] } }],
  comparison: {
    range: { from: "2026-08-01", to: "2026-08-31" },
    series: [{ key: "total", points: { t: days(1, 3, "08"), v: [8, 25, 30] } }],
    totals: { current: 60, comparison: 63, deltaPct: -4.76 },
  },
  projection: null,
  ...patch,
});

describe("request", () => {
  it("keeps the projection off per hour and blocks zone filters", () => {
    const hourly: SeriesWidget = {
      ...line,
      granularity: "hour",
      showProjection: true,
    };
    const q = toSeriesQuery(hourly, {
      ...filters,
      comparison: { mode: "projection" },
      boroughs: ["queens"],
    });
    expect(q.request).toMatchObject({
      includeProjection: false,
      comparison: { mode: "none" },
    });
    expect(q.notices[0]).toMatch(/projeção não existe por hora/);
    expect(q.blocked).toMatch(/não têm distrito nem zona/);
  });

  it("does not overlay the projection when it already is the comparison", () => {
    const q = toSeriesQuery(
      { ...line, showProjection: true },
      { ...filters, comparison: { mode: "projection" } },
    );
    expect(q.request.includeProjection).toBe(false);
    expect(q.request.filters).not.toHaveProperty("comparison");
  });
});

describe("transform", () => {
  it("reads NY wall-clock timestamps as local wall-clock", () => {
    const date = new Date(toMillis("2026-09-01T13:30"));
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([
      1, 13, 30,
    ]);
  });

  it("aligns the comparison on the first day of the current period", () => {
    const datasets = buildDatasets(response(), {
      widget: line,
      periodFrom: "2026-09-01",
      comparisonMode: "previous_period",
      comparisonLabel: "08/2026",
    });
    expect(datasets.map((d) => [d.role, d.label])).toEqual([
      ["current", "Receita"],
      ["comparison", "08/2026"],
    ]);
    const [current, compared] = datasets;
    expect(compared?.points[0]?.x).toBe(current?.points[0]?.x);
    expect(compared?.points[0]?.t).toBe("2026-08-01");
    expect(alignmentOffset("2026-09-01", "2026-08-01")).toBe(
      toMillis("2026-09-01") - toMillis("2026-08-01"),
    );
  });

  it("stacked bars compare against the summed total; projection keeps its dates", () => {
    const stacked: SeriesWidget = {
      ...line,
      type: "stacked_bar",
      groupBy: "service",
    };
    const grouped = response({
      series: [
        { key: "yellow", points: { t: days(1, 2), v: [1, 2] } },
        { key: "fhvhv", points: { t: days(1, 2), v: [3, 4] } },
      ],
      comparison: {
        range: { from: "2026-09-01", to: "2026-09-30" },
        series: [
          { key: "yellow", points: { t: days(1, 2), v: [1, null] } },
          { key: "fhvhv", points: { t: days(1, 2), v: [2, 5] } },
        ],
        totals: { current: 10, comparison: 8, deltaPct: 25 },
      },
    });
    const datasets = buildDatasets(grouped, {
      widget: stacked,
      periodFrom: "2026-09-01",
      comparisonMode: "projection",
      comparisonLabel: "",
    });
    expect(datasets.map((d) => d.label)).toEqual([
      "Apps (Uber/Lyft)",
      "Yellow Taxi",
      "Total (projeção)",
    ]);
    expect(datasets[2]?.role).toBe("projection");
    expect(datasets[2]?.points.map((p) => p.y)).toEqual([3, 5]);
  });

  it("keeps each entity's color when others are filtered out", () => {
    const byCompany: SeriesWidget = { ...line, groupBy: "company" };
    const colors = (keys: string[]) =>
      buildDatasets(
        response({
          comparison: null,
          series: keys.map((key) => ({
            key,
            points: { t: days(1, 1), v: [1] },
          })),
        }),
        {
          widget: byCompany,
          periodFrom: "2026-09-01",
          comparisonMode: "none",
          comparisonLabel: "",
        },
      ).map((d) => [d.label, d.colorIndex]);
    expect(colors(["green", "lyft", "uber", "yellow"])).toEqual([
      ["Uber", 0],
      ["Lyft", 1],
      ["Yellow", 2],
      ["Green", 3],
    ]);
    expect(colors(["yellow", "lyft"])).toEqual([
      ["Lyft", 1],
      ["Yellow", 2],
    ]);
  });

  it("flags deviations from the projection above the threshold", () => {
    const actual = toPoints({
      key: "total",
      points: { t: days(1, 3), v: [100, 115, 80] },
    });
    const expected = toPoints({
      key: "total",
      points: { t: days(1, 3), v: [100, 100, 100] },
    });
    const deviations = projectionDeviations(actual, expected, 10);
    expect([...deviations.values()]).toEqual([15, -20]);
  });
});

describe("chart config", () => {
  const theme = getChartTheme("dark", "aurora");
  const base = {
    theme,
    unit: "usd" as const,
    granularity: "day" as const,
    direction: "higher_is_better" as const,
  };

  it("styles comparison dashed and projection dotted; area fills from the origin", () => {
    const datasets = buildDatasets(
      response({
        projection: {
          series: [{ key: "total", points: { t: days(1, 3), v: [9, 9, 9] } }],
        },
      }),
      {
        widget: line,
        periodFrom: "2026-09-01",
        comparisonMode: "previous_period",
        comparisonLabel: "08/2026",
      },
    );
    const { type, data } = seriesChartConfig(datasets, {
      ...base,
      type: "area",
    });
    expect(type).toBe("line");
    const [current, comparison, projection] = data.datasets as unknown as {
      fill: unknown;
      borderDash?: number[];
    }[];
    expect(current?.fill).toBe("origin");
    expect(comparison?.borderDash).toEqual([6, 4]);
    expect(projection?.borderDash).toEqual([2, 4]);
  });

  it("turns on LTTB decimation above 1,000 points (24 months hourly)", () => {
    const t = Array.from({ length: 17_520 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 9, 1, i));
      return d.toISOString().slice(0, 16);
    });
    const big = buildDatasets(
      response({
        granularity: "hour",
        series: [{ key: "total", points: { t, v: t.map((_, i) => i % 97) } }],
        comparison: null,
      }),
      {
        widget: { ...line, type: "line", granularity: "hour" },
        periodFrom: "2024-10-01",
        comparisonMode: "none",
        comparisonLabel: "",
      },
    );
    const { options } = seriesChartConfig(big, {
      ...base,
      type: "line",
      granularity: "hour",
    });
    expect(options).toMatchObject({
      animation: false,
      parsing: false,
      plugins: { decimation: { enabled: true, algorithm: "lttb" } },
      scales: { x: { time: { unit: false, minUnit: "hour" } } },
    });

    const small = seriesChartConfig(big.slice(0, 0), { ...base, type: "line" });
    expect(small.options.plugins).not.toHaveProperty("decimation");
  });

  it("lines and areas reveal left to right; bars and big series do not", () => {
    const datasets = buildDatasets(response(), {
      widget: line,
      periodFrom: "2026-09-01",
      comparisonMode: "previous_period",
      comparisonLabel: "08/2026",
    });
    const area = seriesChartConfig(datasets, { ...base, type: "area" });
    const x = (
      area.options.animations as Record<
        string,
        {
          delay: (ctx: object) => number;
          duration: (ctx: object) => number;
          from: unknown;
        }
      >
    ).x;
    if (!x) throw new Error("no x animation");
    expect(Number.isNaN(x.from)).toBe(true);
    // 3 points: eased-out timeline, the last point ends at ANIMATION_MS
    const ctx = (index: number) => ({ type: "data", index, datasetIndex: 0 });
    const starts = [0, 1, 2].map((i) => x.delay(ctx(i)));
    const ends = [0, 1, 2].map((i) => (starts[i] ?? 0) + x.duration(ctx(i)));
    expect(starts[0]).toBe(0);
    expect(ends[2]).toBeCloseTo(ANIMATION_MS, 5);
    // fast start, slow end: each slice is longer than the previous one
    expect(x.duration(ctx(0))).toBeLessThan(x.duration(ctx(1)));
    expect(x.duration(ctx(1))).toBeLessThan(x.duration(ctx(2)));
    expect(
      seriesChartConfig(datasets, { ...base, type: "bar" }).options,
    ).not.toHaveProperty("animations");
  });

  it("bars appear left to right, each with a vivid-to-pastel gradient", () => {
    const datasets = buildDatasets(response({ comparison: null }), {
      widget: { ...line, type: "bar" },
      periodFrom: "2026-09-01",
      comparisonMode: "none",
      comparisonLabel: "",
    });
    const { data, options } = seriesChartConfig(datasets, {
      ...base,
      type: "bar",
    });
    const { delay, duration, easing } = options.animation as {
      delay: (ctx: object) => number;
      duration: number;
      easing: string;
    };
    const at = (dataIndex: number) =>
      delay({ type: "data", mode: "default", dataIndex });
    expect(easing).toBe("easeOutCubic");
    expect(at(0)).toBe(0);
    // the last bar finishes growing at ANIMATION_MS, and starts spread out more and more
    expect(at(2) + duration).toBeCloseTo(ANIMATION_MS, 5);
    expect(at(1) - at(0)).toBeLessThan(at(2) - at(1));
    const gradient = (
      data.datasets[0] as unknown as {
        nydGradient: { tip: string; base: string };
      }
    ).nydGradient;
    expect(gradient.tip).toBe(theme.series[0]);
    expect(gradient.base).not.toBe(gradient.tip);
  });

  it("stacks bars on both axes", () => {
    const { type, options } = seriesChartConfig([], {
      ...base,
      type: "stacked_bar",
    });
    expect(type).toBe("bar");
    expect(options.scales).toMatchObject({
      x: { stacked: true, offset: true },
      y: { stacked: true },
    });
  });
});

describe("TimeSeriesWidget", () => {
  let body: TimeseriesResponse;
  beforeEach(() => {
    body = response();
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

  const renderWidget = (widget: SeriesWidget = line, f = filters) =>
    render(
      <QueryClientProvider client={createQueryClient()}>
        <TimeSeriesWidget widget={widget} filters={f} breakpoint="desktop" />
      </QueryClientProvider>,
    );

  it("draws current × comparison with totals and the change", async () => {
    renderWidget();
    expect(await screen.findByTestId("chart")).toHaveTextContent(
      "Receita | 08/2026",
    );
    expect(screen.getByText("09/2026:")).toBeInTheDocument();
    expect(screen.getByText("−4,8%")).toBeInTheDocument();
    expect(screen.getByText("(piorou)")).toBeInTheDocument();
  });

  it("shows 'não se aplica' and API notices", async () => {
    body = response({ notApplicable: true });
    renderWidget();
    expect(await screen.findByText("Não se aplica")).toBeInTheDocument();
  });

  it("explains instead of querying hourly data with a borough filter", () => {
    renderWidget(
      { ...line, granularity: "hour" },
      { ...filters, boroughs: ["bronx"] },
    );
    expect(screen.getByText(/não têm distrito nem zona/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
