import {
  type BreakdownResponse,
  DEFAULT_GLOBAL_FILTERS,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { getChartTheme } from "../charts/chartTheme";
import { categoricalChartConfig } from "../widgets/categorical/categoricalChart";
import { CategoricalWidget } from "../widgets/categorical/CategoricalWidget";
import {
  type CategoricalWidget as Widget,
  defaultTopN,
  OTHERS_KEY,
  shareOf,
  toBreakdownQuery,
  toCategories,
} from "../widgets/categorical/transform";
import { resolveWidgetFilters } from "../widgets/resolveFilters";

vi.mock("react-chartjs-2", () => ({
  Chart: (props: {
    type: string;
    data: { labels: string[]; datasets: { label: string }[] };
  }) => (
    <div data-testid="chart" data-type={props.type}>
      {props.data.datasets.map((d) => d.label).join(" | ")}
    </div>
  ),
}));

const filters = resolveWidgetFilters(DEFAULT_GLOBAL_FILTERS, undefined);
const doughnut: Widget = {
  id: "d",
  type: "doughnut",
  title: "Participação por empresa",
  metric: "trips",
  dimension: "company",
};
const radar: Widget = {
  id: "r",
  type: "radar",
  title: "Por hora",
  metric: "trips",
  dimension: "hour_of_day",
};

const row = (key: string, label: string, value: number, before: number) => ({
  keys: [key],
  labels: [label],
  value,
  comparisonValue: before,
  deltaPct: ((value - before) / before) * 100,
});

const companies: BreakdownResponse = {
  metric: "trips",
  dimensions: ["company"],
  unit: "count",
  notices: [],
  notApplicable: false,
  rows: [
    row("uber", "Uber", 600, 500),
    row("yellow", "Yellow", 250, 300),
    row("lyft", "Lyft", 100, 100),
  ],
  others: { value: 50, comparisonValue: 40 },
};

describe("request", () => {
  it("orders hours and weekdays by key and keeps all of them", () => {
    const { request } = toBreakdownQuery(radar, filters);
    expect(request).toMatchObject({ sort: "asc", sortBy: "key" });
    expect(request).not.toHaveProperty("topN");
  });

  it("ranks the rest by value with a top N per chart type", () => {
    expect(toBreakdownQuery(doughnut, filters).request).toMatchObject({
      sort: "desc",
      sortBy: "value",
    });
    expect(toBreakdownQuery(doughnut, filters).request).not.toHaveProperty(
      "topN",
    );
    expect(defaultTopN({ ...doughnut, dimension: "zone" })).toBe(6);
    expect(
      defaultTopN({ ...doughnut, type: "bar_horizontal", dimension: "zone" }),
    ).toBe(10);
    expect(defaultTopN({ ...doughnut, topN: 3 })).toBe(3);
  });

  it("blocks the hour of day with borough or zone filters", () => {
    expect(
      toBreakdownQuery(radar, { ...filters, zones: [132] }).blocked,
    ).toMatch(/não têm distrito nem zona/);
  });
});

describe("categories", () => {
  it("keeps each company's color slot and puts 'Outros' last in neutral", () => {
    const categories = toCategories(companies, "company");
    expect(categories.map((c) => [c.label, c.slot])).toEqual([
      ["Uber", 0],
      ["Yellow", 2],
      ["Lyft", 1],
      ["Outros", -1],
    ]);
    expect(categories.at(-1)).toMatchObject({ key: OTHERS_KEY, deltaPct: 25 });
  });

  it("rankings and radars leave 'Outros' out", () => {
    const ranked = toCategories(companies, "company", { withOthers: false });
    expect(ranked.map((c) => c.key)).not.toContain(OTHERS_KEY);
  });

  it("computes shares of the total", () => {
    const { total, share } = shareOf(toCategories(companies, "company"));
    expect(total).toBe(1000);
    expect(share(600)).toBe(60);
  });
});

describe("chart config", () => {
  const theme = getChartTheme("light", "ocean");
  const categories = toCategories(companies, "company");
  const options = {
    theme,
    unit: "count" as const,
    currentLabel: "09/2026",
    comparisonLabel: "08/2026",
  };

  it("colors doughnut slices by entity, 'Outros' neutral", () => {
    const config = categoricalChartConfig(categories, {
      ...options,
      type: "doughnut",
    });
    const colors = config.data.datasets[0]?.backgroundColor as string[];
    expect(colors[0]).toBe(theme.series[0]);
    expect(colors[1]).toBe(theme.series[2]);
    expect(colors[3]).toBe(theme.other);
    expect(config.options).toMatchObject({ cutout: "68%" });
  });

  it("radar compares periods with a dashed second series", () => {
    const config = categoricalChartConfig(categories, {
      ...options,
      type: "radar",
    });
    expect(config.data.datasets.map((d) => d.label)).toEqual([
      "09/2026",
      "08/2026",
    ]);
    expect(
      (config.data.datasets[1] as { borderDash?: number[] }).borderDash,
    ).toEqual([6, 4]);
  });

  it("ranking bars are horizontal and single-hued", () => {
    const config = categoricalChartConfig(categories, {
      ...options,
      type: "bar_horizontal",
      comparisonLabel: null,
    });
    expect(config.type).toBe("bar");
    expect(config.options).toMatchObject({ indexAxis: "y" });
    expect(config.data.datasets).toHaveLength(1);
    const colors = config.data.datasets[0]?.backgroundColor as string[];
    expect(new Set(colors.slice(0, 3)).size).toBe(1);
  });
});

describe("CategoricalWidget", () => {
  let body: BreakdownResponse;
  beforeEach(() => {
    body = companies;
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

  const renderWidget = (widget: Widget) =>
    render(
      <QueryClientProvider client={createQueryClient()}>
        <CategoricalWidget
          widget={widget}
          filters={filters}
          breakpoint="desktop"
        />
      </QueryClientProvider>,
    );

  it("doughnut shows the total in the middle and a legend with shares and changes", async () => {
    renderWidget(doughnut);
    expect(await screen.findByTestId("chart")).toHaveAttribute(
      "data-type",
      "doughnut",
    );
    expect(screen.getByText("total")).toBeInTheDocument();
    expect(screen.getByText("Uber")).toBeInTheDocument();
    expect(screen.getByText("60,0%")).toBeInTheDocument();
    expect(screen.getByText("+20,0%")).toBeInTheDocument();
  });

  it("labels the compared period like the API computes it", async () => {
    renderWidget(radar);
    expect(await screen.findByTestId("chart")).toHaveTextContent(
      "09/2026 | 08/2026",
    );
  });

  it("explains 'não se aplica' with the API notice", async () => {
    body = {
      ...companies,
      notApplicable: true,
      rows: [],
      others: null,
      notices: ["Para rotas há apenas corridas, receita, distância e duração."],
    };
    renderWidget(doughnut);
    expect(await screen.findByText("Não se aplica")).toBeInTheDocument();
    expect(screen.getByText(/Para rotas há apenas/)).toBeInTheDocument();
  });
});
