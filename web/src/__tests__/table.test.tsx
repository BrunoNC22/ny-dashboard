import {
  type BreakdownRequest,
  type BreakdownResponse,
  createDefaultDashboard,
  DEFAULT_GLOBAL_FILTERS,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { useDashboardStore } from "../stores/dashboardStore";
import { resolveWidgetFilters } from "../widgets/resolveFilters";
import { TableWidget } from "../widgets/table/TableWidget";
import {
  columnMax,
  joinColumns,
  nextSort,
  type TableWidget as Table,
  toTableRequests,
} from "../widgets/table/transform";

const table = createDefaultDashboard().widgets.find(
  (w) => w.id === "table-top-zones",
) as Table;
const filters = resolveWidgetFilters(DEFAULT_GLOBAL_FILTERS, undefined);

const row = (key: string, label: string, value: number, deltaPct: number) => ({
  keys: [key],
  labels: [label],
  value,
  comparisonValue: null,
  deltaPct,
});
const response = (
  metric: BreakdownResponse["metric"],
  rows: BreakdownResponse["rows"],
): BreakdownResponse => ({
  metric,
  dimensions: ["zone"],
  unit: metric === "trips" ? "count" : "usd",
  notices: [],
  notApplicable: false,
  rows,
  others: null,
});

const byMetric: Record<string, BreakdownResponse> = {
  trips: response("trips", [
    row("132", "JFK Airport", 900, 5),
    row("138", "LaGuardia Airport", 600, -3),
  ]),
  revenue: response("revenue", [
    row("138", "LaGuardia Airport", 30_000, 1),
    row("132", "JFK Airport", 70_000, 2),
  ]),
  avg_fare: response("avg_fare", [row("132", "JFK Airport", 70, 0)]),
};

describe("transform", () => {
  it("ranks by the sorting column and joins the others by key", () => {
    const requests = toTableRequests(table, filters);
    expect(requests.map((r) => [r.metric, r.topN, r.sort])).toEqual([
      ["trips", 15, "desc"],
      ["revenue", undefined, "desc"],
      ["avg_fare", undefined, "desc"],
    ]);
    const rows = joinColumns(table, [
      byMetric.trips,
      byMetric.revenue,
      byMetric.avg_fare,
    ]);
    expect(rows.map((r) => r.label)).toEqual([
      "JFK Airport",
      "LaGuardia Airport",
    ]);
    expect(rows[1]?.cells.revenue?.value).toBe(30_000);
    expect(rows[1]?.cells.avg_fare).toBeUndefined();
    expect(columnMax(rows, "trips")).toBe(900);
  });

  it("flips the direction on the same column, sorts others descending", () => {
    expect(nextSort(table, "trips")).toEqual({
      sortBy: "trips",
      sortDir: "asc",
    });
    expect(nextSort(table, "revenue")).toEqual({
      sortBy: "revenue",
      sortDir: "desc",
    });
  });
});

describe("TableWidget", () => {
  beforeEach(() => {
    useDashboardStore.getState().hydrate(createDefaultDashboard());
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        const { metric } = JSON.parse(init.body as string) as BreakdownRequest;
        return Promise.resolve(
          new Response(JSON.stringify(byMetric[metric]), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderTable = (preview = false) =>
    render(
      <QueryClientProvider client={createQueryClient()}>
        <TableWidget
          widget={table}
          filters={filters}
          breakpoint="desktop"
          preview={preview}
        />
      </QueryClientProvider>,
    );

  it("renders ranked rows, joined columns, missing cells and the change", async () => {
    renderTable();
    const table = await screen.findByRole("table");
    const [, first, second] = within(table).getAllByRole("row");
    expect(first).toHaveTextContent(/1JFK Airport900US\$ 70 milUS\$ 70\+5,0%/);
    expect(second).toHaveTextContent(/2LaGuardia Airport600US\$ 30 mil—−3,0%/);
    expect(
      within(table).getByRole("columnheader", { name: /Corridas/ }),
    ).toHaveAttribute("aria-sort", "descending");
  });

  it("sorting by a header is saved in the widget (undoable)", async () => {
    renderTable();
    await userEvent.click(
      await screen.findByRole("button", { name: /Receita/ }),
    );
    const saved = useDashboardStore
      .getState()
      .state.widgets.find((w) => w.id === "table-top-zones");
    expect(saved).toMatchObject({ sortBy: "revenue", sortDir: "desc" });
    expect(useDashboardStore.getState().past).toHaveLength(1);
  });

  it("does not change the widget from the editor preview", async () => {
    renderTable(true);
    await userEvent.click(
      await screen.findByRole("button", { name: /Receita/ }),
    );
    expect(useDashboardStore.getState().past).toHaveLength(0);
  });
});
