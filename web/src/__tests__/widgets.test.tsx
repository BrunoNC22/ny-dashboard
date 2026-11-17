import {
  BREAKPOINTS,
  createDefaultDashboard,
  DEFAULT_GLOBAL_FILTERS,
  WIDGET_TYPES,
  type WidgetConfig,
} from "@ny-dashboard/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardStore } from "../stores/dashboardStore";
import { useUiStore } from "../stores/uiStore";
import { WIDGET_REGISTRY } from "../widgets/registry";
import {
  overriddenFilterLabels,
  resolveWidgetFilters,
} from "../widgets/resolveFilters";
import { WidgetBody } from "../widgets/WidgetBody";
import { WidgetErrorBoundary } from "../widgets/WidgetErrorBoundary";
import { WidgetFrame } from "../widgets/WidgetFrame";
import { WidgetRenderer } from "../widgets/WidgetRenderer";

const defaults = createDefaultDashboard();
const byId = (id: string) => {
  const widget = defaults.widgets.find((w) => w.id === id);
  if (!widget) throw new Error(id);
  return widget;
};

beforeEach(() => {
  useDashboardStore.getState().hydrate(createDefaultDashboard());
  useUiStore.setState({ editingWidgetId: null });
});

describe("filter resolution", () => {
  it("inherits every global filter when there is no override", () => {
    expect(resolveWidgetFilters(DEFAULT_GLOBAL_FILTERS, undefined)).toEqual({
      ...DEFAULT_GLOBAL_FILTERS,
      zones: [],
    });
  });

  it("replaces only the overridden fields (an empty list is an override too)", () => {
    const global = {
      ...DEFAULT_GLOBAL_FILTERS,
      services: ["yellow" as const],
      boroughs: ["queens" as const],
    };
    const effective = resolveWidgetFilters(global, {
      comparison: { mode: "projection" },
      boroughs: [],
      zones: [132],
    });
    expect(effective).toEqual({
      period: global.period,
      comparison: { mode: "projection" },
      services: ["yellow"],
      companies: [],
      boroughs: [],
      zones: [132],
    });
  });

  it("names the overridden filters", () => {
    expect(overriddenFilterLabels(undefined)).toEqual([]);
    expect(overriddenFilterLabels(byId("scatter-jfk").filters)).toEqual([
      "período",
      "zona",
    ]);
  });
});

describe("registry", () => {
  it("registers every widget type", () => {
    expect(Object.keys(WIDGET_REGISTRY).sort()).toEqual(
      [...WIDGET_TYPES].sort(),
    );
    for (const type of WIDGET_TYPES) {
      for (const bp of BREAKPOINTS) {
        const { w, h, minW, minH } = WIDGET_REGISTRY[type].sizes[bp];
        expect(w).toBeGreaterThanOrEqual(minW);
        expect(h).toBeGreaterThanOrEqual(minH);
      }
    }
  });

  it("the default dashboard respects the minimum sizes", () => {
    for (const bp of BREAKPOINTS) {
      for (const item of defaults.layouts[bp]) {
        const { type } = byId(item.i);
        const { minW, minH } = WIDGET_REGISTRY[type].sizes[bp];
        expect([item.i, item.w >= minW, item.h >= minH]).toEqual([
          item.i,
          true,
          true,
        ]);
      }
    }
  });
});

describe("WidgetBody states", () => {
  it("loading, error with retry, empty, not applicable and ready", async () => {
    const retry = vi.fn();
    const { rerender } = render(<WidgetBody status="loading" />);
    expect(screen.getByLabelText("Carregando")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    rerender(<WidgetBody status="error" onRetry={retry} />);
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );
    expect(retry).toHaveBeenCalledOnce();

    rerender(<WidgetBody status="empty" />);
    expect(screen.getByText("Sem dados")).toBeInTheDocument();

    rerender(<WidgetBody status="not_applicable" />);
    expect(screen.getByText("Não se aplica")).toBeInTheDocument();

    rerender(
      <WidgetBody status="ready">
        <p>conteúdo</p>
      </WidgetBody>,
    );
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });
});

describe("WidgetFrame", () => {
  const frame = (widget: WidgetConfig, readOnly = false) =>
    render(
      <WidgetFrame widget={widget} readOnly={readOnly}>
        corpo
      </WidgetFrame>,
    );

  it("shows the title, the override badge and the drag handle", () => {
    frame(byId("scatter-jfk"));
    const region = screen.getByRole("region", {
      name: "Distância × tarifa: embarques no JFK (amostra)",
    });
    expect(region.querySelector(".widget-drag-handle")).not.toBeNull();
    expect(
      screen.getByText("filtros próprios: período, zona"),
    ).toBeInTheDocument();
  });

  it("edits, duplicates and removes", async () => {
    frame(byId("kpi-revenue"));
    // jsdom has no media queries: the phone and the desktop edit buttons are both present
    const [edit] = screen.getAllByRole("button", { name: "Editar Receita" });
    if (!edit) throw new Error("missing edit button");
    await userEvent.click(edit);
    expect(useUiStore.getState().editingWidgetId).toBe("kpi-revenue");

    await userEvent.click(
      screen.getByRole("button", { name: "Duplicar Receita" }),
    );
    expect(useDashboardStore.getState().state.widgets).toHaveLength(15);

    await userEvent.click(
      screen.getByRole("button", { name: "Remover Receita" }),
    );
    expect(
      useDashboardStore
        .getState()
        .state.widgets.some((w) => w.id === "kpi-revenue"),
    ).toBe(false);
  });

  it("read-only (editor preview) has no actions and no drag handle", () => {
    const { container } = frame(byId("kpi-trips"), true);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector(".widget-drag-handle")).toBeNull();
  });
});

describe("rendering", () => {
  it("contains a crashing widget and recovers when its config changes", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Boom = () => {
      throw new Error("boom");
    };
    const { rerender } = render(
      <WidgetErrorBoundary resetKey="a">
        <Boom />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByText("Erro ao desenhar o widget.")).toBeInTheDocument();
    rerender(
      <WidgetErrorBoundary resetKey="b">
        <p>ok</p>
      </WidgetErrorBoundary>,
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
    vi.mocked(console.error).mockRestore();
  });

  it("lazy-loads heavy widgets (map) behind a skeleton", async () => {
    render(<WidgetRenderer widget={byId("map-zones")} breakpoint="desktop" />);
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
    expect(await screen.findByText(/em construção/)).toBeInTheDocument();
  });
});
