import {
  createDefaultDashboard,
  DEFAULT_GLOBAL_FILTERS,
  type KpiResponse,
  METRICS,
  type WidgetConfigOf,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { KpiWidget } from "../widgets/kpi/KpiWidget";
import {
  sparkPoints,
  targetProgress,
  toKpiRequest,
} from "../widgets/kpi/transform";
import { METRIC_ICONS } from "../widgets/metricIcons";
import { resolveWidgetFilters } from "../widgets/resolveFilters";

vi.mock("react-chartjs-2", () => ({
  Line: (props: { data: { datasets: { data: unknown[] }[] } }) => (
    <div data-testid="sparkline">{props.data.datasets[0]?.data.length}</div>
  ),
}));

const revenue = createDefaultDashboard().widgets.find(
  (w) => w.id === "kpi-revenue",
) as WidgetConfigOf<"kpi">;
const filters = resolveWidgetFilters(DEFAULT_GLOBAL_FILTERS, undefined);

const kpi = (patch: Partial<KpiResponse> = {}): KpiResponse => ({
  metric: "revenue",
  notApplicable: false,
  value: 869_000_000,
  comparison: {
    range: { from: "2026-08-01", to: "2026-08-31" },
    value: 788_200_000,
    deltaAbs: 80_800_000,
    deltaPct: 10.25,
  },
  target: 900_000_000,
  status: "warning",
  sparkline: { t: ["2026-09-01", "2026-09-02", "2026-09-03"], v: [1, 2, 3] },
  ...patch,
});

describe("transform", () => {
  it("sends the widget's evaluation and the effective comparison", () => {
    expect(toKpiRequest(revenue, filters)).toEqual({
      metric: "revenue",
      filters: {
        period: filters.period,
        services: [],
        companies: [],
        boroughs: [],
        zones: [],
      },
      comparison: { mode: "previous_period" },
      evaluation: revenue.evaluation,
      sparkline: true,
    });
  });

  it("computes target progress and sparkline points", () => {
    expect(targetProgress(kpi())).toBeCloseTo(96.56, 1);
    expect(targetProgress(kpi({ target: null }))).toBeNull();
    expect(sparkPoints(kpi()).map((p) => p.y)).toEqual([1, 2, 3]);
  });

  it("has an icon for every metric of the catalog", () => {
    for (const metric of Object.values(METRICS)) {
      expect([metric.id, metric.icon in METRIC_ICONS]).toEqual([
        metric.id,
        true,
      ]);
    }
  });
});

describe("KpiWidget", () => {
  let body: KpiResponse;
  beforeEach(() => {
    body = kpi();
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

  const renderKpi = (widget = revenue) =>
    render(
      <QueryClientProvider client={createQueryClient()}>
        <KpiWidget widget={widget} filters={filters} breakpoint="desktop" />
      </QueryClientProvider>,
    );

  it.each([
    ["good", "Bom"],
    ["warning", "Atenção"],
    ["bad", "Ruim"],
    ["neutral", "Sem avaliação"],
  ] as const)(
    "shows the %s status with icon and text",
    async (status, text) => {
      body = kpi({ status });
      renderKpi();
      expect(await screen.findByText(text)).toBeInTheDocument();
    },
  );

  it("shows the value, the change against the compared month, the target and the sparkline", async () => {
    renderKpi();
    expect(await screen.findByText("US$ 869 mi")).toBeInTheDocument();
    expect(screen.getByText("+10,3%")).toBeInTheDocument();
    expect(screen.getByText("(melhorou)")).toBeInTheDocument();
    expect(screen.getByText(/vs\. 08\/2026/)).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Progresso da meta" }),
    ).toHaveAttribute("aria-valuenow", "97");
    expect(screen.getByTestId("sparkline")).toHaveTextContent("3");
  });

  it("follows an inverted direction (lower is better)", async () => {
    renderKpi({
      ...revenue,
      evaluation: { ...revenue.evaluation, direction: "lower_is_better" },
    });
    expect(await screen.findByText("(piorou)")).toBeInTheDocument();
  });

  it("says when the metric does not apply", async () => {
    body = kpi({ notApplicable: true, value: null });
    renderKpi();
    expect(await screen.findByText("Não se aplica")).toBeInTheDocument();
  });
});
