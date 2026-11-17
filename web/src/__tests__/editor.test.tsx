import {
  createDefaultDashboard,
  type WidgetConfig,
  type WidgetConfigOf,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { useDashboardStore } from "../stores/dashboardStore";
import { useUiStore } from "../stores/uiStore";
import { compatibleTypes, convertWidgetType } from "../widgets/editor/convert";
import { WidgetEditor } from "../widgets/editor/WidgetEditor";

const widget = <T extends WidgetConfig["type"]>(id: string) =>
  createDefaultDashboard().widgets.find(
    (w) => w.id === id,
  ) as WidgetConfigOf<T>;
const stored = (id: string) =>
  useDashboardStore.getState().state.widgets.find((w) => w.id === id);

describe("convertWidgetType", () => {
  it("switches inside a family keeping the shared fields", () => {
    const line = widget<"line">("line-trips-projection");
    const stacked = convertWidgetType(line, "stacked_bar");
    expect(stacked).toMatchObject({
      type: "stacked_bar",
      metric: "trips",
      groupBy: "service",
      filters: line.filters,
    });
    expect(convertWidgetType(stacked, "area")).toMatchObject({
      type: "area",
      groupBy: "service",
    });

    const scatter = widget<"scatter">("scatter-jfk");
    const bubble = convertWidgetType(scatter, "bubble");
    expect(bubble).toMatchObject({ type: "bubble", r: "tips" });
    expect(convertWidgetType(bubble, "scatter")).toEqual(scatter);

    expect(compatibleTypes("pie")).toContain("bar_horizontal");
    expect(() => convertWidgetType(scatter, "kpi")).toThrow();
  });
});

describe("WidgetEditor", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { code: "X", message: "x" } }), {
            status: 503,
          }),
        ),
      ),
    );
    useDashboardStore.getState().hydrate(createDefaultDashboard());
    useUiStore.setState({ editingWidgetId: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const open = (id: string) => {
    useUiStore.getState().editWidget(id);
    render(
      <QueryClientProvider client={createQueryClient()}>
        <WidgetEditor />
      </QueryClientProvider>,
    );
    return screen.getByRole("dialog");
  };

  it("previews live and saves as one undoable step", async () => {
    const dialog = open("kpi-revenue");
    const title = within(dialog).getByLabelText("Título");
    await userEvent.clear(title);
    await userEvent.type(title, "Faturamento");
    const preview = within(dialog).getByTestId("widget-preview");
    expect(
      within(preview).getByRole("region", { name: "Faturamento" }),
    ).toBeInTheDocument();
    expect(stored("kpi-revenue")?.title).toBe("Receita"); // not saved yet

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar" }),
    );
    expect(stored("kpi-revenue")?.title).toBe("Faturamento");
    expect(useUiStore.getState().editingWidgetId).toBeNull();
    useDashboardStore.getState().undo();
    expect(stored("kpi-revenue")?.title).toBe("Receita");
  });

  it("cancel discards the draft", async () => {
    const dialog = open("kpi-trips");
    await userEvent.type(within(dialog).getByLabelText("Título"), " extra");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    );
    expect(stored("kpi-trips")?.title).toBe("Corridas");
    expect(useDashboardStore.getState().past).toHaveLength(0);
  });

  it("blocks saving an invalid config and says why", async () => {
    const dialog = open("kpi-trips");
    await userEvent.clear(within(dialog).getByLabelText("Título"));
    expect(
      within(dialog).getByRole("button", { name: "Salvar" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByText("Dê um título ao widget."),
    ).toBeInTheDocument();
  });

  it("changes the type within the family and the type-specific fields", async () => {
    const dialog = open("area-revenue-mom");
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Tipo"),
      "stacked_bar",
    );
    const groupBy = within(dialog).getByLabelText("Agrupar séries por");
    expect(
      within(groupBy).queryByRole("option", { name: "Sem agrupamento" }),
    ).toBeNull();
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Granularidade"),
      "hour",
    );
    expect(
      within(dialog).getByRole("switch", { name: "Mostrar a projeção" }),
    ).toBeDisabled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar" }),
    );
    expect(stored("area-revenue-mom")).toMatchObject({
      type: "stacked_bar",
      groupBy: "service",
      granularity: "hour",
      showProjection: false,
    });
  });

  it("configures the KPI target", async () => {
    const dialog = open("kpi-avg-fare");
    await userEvent.click(
      within(dialog).getByRole("switch", { name: "Usar uma meta" }),
    );
    const target = within(dialog).getByLabelText(/^Meta/);
    await userEvent.clear(target);
    await userEvent.type(target, "25");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar" }),
    );
    expect(stored("kpi-avg-fare")).toMatchObject({
      evaluation: { target: { value: 25, warningBandPct: 5 } },
    });
  });

  it("overrides a filter and can follow the global one again", async () => {
    const dialog = open("doughnut-company-share");
    await userEvent.click(within(dialog).getByRole("tab", { name: "Filtros" }));
    await userEvent.click(
      within(dialog).getByRole("switch", { name: /Comparação própria/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar" }),
    );
    expect(stored("doughnut-company-share")?.filters).toEqual({
      comparison: { mode: "previous_period" },
    });

    useUiStore.getState().editWidget("doughnut-company-share");
    const again = await screen.findByRole("dialog");
    await userEvent.click(within(again).getByRole("tab", { name: "Filtros" }));
    await userEvent.click(
      within(again).getByRole("switch", { name: /Comparação própria/ }),
    );
    await userEvent.click(
      within(again).getByRole("button", { name: "Salvar" }),
    );
    expect(stored("doughnut-company-share")).not.toHaveProperty("filters");
  });

  it("removes the widget from the editor (phones have no remove button)", async () => {
    const dialog = open("radar-hour-of-day");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remover" }),
    );
    expect(stored("radar-hour-of-day")).toBeUndefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
