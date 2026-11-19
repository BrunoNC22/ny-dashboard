import {
  createDefaultDashboard,
  dashboardStateSchema,
  widgetConfigSchema,
} from "@ny-dashboard/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardStore } from "../stores/dashboardStore";
import { useUiStore } from "../stores/uiStore";
import { WIDGET_REGISTRY } from "../widgets/registry";
import {
  GROUP_LABELS,
  instantiateTemplate,
  searchTemplates,
  WIDGET_TEMPLATES,
} from "../widgets/templates";
import { WidgetGallery } from "../widgets/WidgetGallery";

beforeEach(() => {
  useDashboardStore.getState().hydrate(createDefaultDashboard());
  useUiStore.setState({ galleryOpen: false });
});

describe("templates", () => {
  it("every template builds a valid widget, and every group has templates", () => {
    for (const template of WIDGET_TEMPLATES) {
      const { widget } = instantiateTemplate(template);
      const parsed = widgetConfigSchema.safeParse(widget);
      expect([template.id, parsed.success]).toEqual([template.id, true]);
    }
    const groups = new Set(WIDGET_TEMPLATES.map((t) => t.group));
    expect([...groups].sort()).toEqual(Object.keys(GROUP_LABELS).sort());
    expect(new Set(WIDGET_TEMPLATES.map((t) => t.id)).size).toBe(
      WIDGET_TEMPLATES.length,
    );
  });

  it("searches ignoring case and accents", () => {
    const names = (q: string) =>
      searchTemplates(WIDGET_TEMPLATES, q).map((t) => t.id);
    expect(names("projecao")).toEqual(["line-trips-projection"]);
    expect(names("HEXÁGONOS")).toEqual(["map-hexagon"]);
    expect(names("  ")).toHaveLength(WIDGET_TEMPLATES.length);
  });
});

describe("WidgetGallery", () => {
  it("adds the chosen template at the end of both layouts", async () => {
    useUiStore.getState().openGallery();
    render(<WidgetGallery />);
    const dialog = screen.getByRole("dialog", { name: "Adicionar widget" });
    expect(
      within(dialog).getByRole("heading", { name: "Mapas" }),
    ).toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByLabelText("Buscar modelos"),
      "rotas",
    );
    expect(within(dialog).queryByRole("heading", { name: "KPIs" })).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: /Rotas mais frequentes.*Tabela/,
      }),
    );

    const { state } = useDashboardStore.getState();
    const added = state.widgets.at(-1);
    expect(added).toMatchObject({ type: "table", dimension: "route" });
    const id = added?.id ?? "";
    const { sizes } = WIDGET_REGISTRY.table;
    expect(state.layouts.desktop.find((i) => i.i === id)).toMatchObject({
      x: 0,
      w: sizes.desktop.w,
      h: sizes.desktop.h,
    });
    expect(state.layouts.mobile.find((i) => i.i === id)).toMatchObject({
      x: 0,
      w: sizes.mobile.w,
      h: sizes.mobile.h,
    });
    expect(dashboardStateSchema.safeParse(state).success).toBe(true);
    expect(useUiStore.getState().galleryOpen).toBe(false);
    expect(useDashboardStore.getState().past).toHaveLength(1);
  });

  it("scrolls to the new widget once the grid renders it, even a few frames later", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    useUiStore.getState().openGallery();
    render(<WidgetGallery />);
    await userEvent.type(screen.getByLabelText("Buscar modelos"), "rotas");
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    await userEvent.click(
      screen.getByRole("button", { name: /Rotas mais frequentes.*Mapa/ }),
    );
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(scrollIntoView).not.toHaveBeenCalled(); // not in the DOM yet

    const id = useDashboardStore.getState().state.widgets.at(-1)?.id ?? "";
    const element = document.createElement("div");
    element.dataset.widgetId = id;
    document.body.append(element);
    vi.advanceTimersToNextFrame();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(element);
    element.remove();
    vi.useRealTimers();
  });

  it("tells when nothing matches", async () => {
    useUiStore.getState().openGallery();
    render(<WidgetGallery />);
    await userEvent.type(screen.getByLabelText("Buscar modelos"), "xyzzy");
    expect(screen.getByText(/Nenhum modelo encontrado/)).toBeInTheDocument();
  });
});
