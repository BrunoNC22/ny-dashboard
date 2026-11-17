import {
  createDefaultDashboard,
  DEFAULT_PREFERENCES,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { routes } from "../routes";
import { useDashboardStore } from "../stores/dashboardStore";
import { usePreferencesStore } from "../stores/preferencesStore";
import { useUiStore } from "../stores/uiStore";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "x" } }),
          { status: 401 },
        ),
      ),
    ),
  );
  localStorage.clear();
  useDashboardStore.setState({
    state: createDefaultDashboard(),
    past: [],
    future: [],
    dirty: false,
    revision: 0,
  });
  usePreferencesStore.setState({
    preferences: DEFAULT_PREFERENCES,
    revision: 0,
    dirty: false,
    locked: false,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const renderDashboard = async () => {
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText("Receita");
  // jsdom has no layout: both the desktop and the mobile header are in the DOM.
  return within(screen.getByRole("banner"));
};

describe("app shell", () => {
  it("undo/redo buttons follow the history, and Ctrl+Z / Ctrl+Shift+Z work", async () => {
    const header = await renderDashboard();
    const undo = header.getByRole("button", { name: "Desfazer (Ctrl+Z)" });
    const redo = header.getByRole("button", { name: "Refazer (Ctrl+Shift+Z)" });
    expect(undo).toBeDisabled();

    useDashboardStore.getState().removeWidget("kpi-trips");
    expect(
      await screen.findByRole("button", { name: "Desfazer (Ctrl+Z)" }),
    ).toBeEnabled();

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(useDashboardStore.getState().state.widgets).toHaveLength(14);
    expect(redo).toBeEnabled();

    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(useDashboardStore.getState().state.widgets).toHaveLength(13);
  });

  it("does not hijack Ctrl+Z inside text fields", async () => {
    await renderDashboard();
    useDashboardStore.getState().removeWidget("kpi-trips");
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(useDashboardStore.getState().state.widgets).toHaveLength(13);
    input.remove();
  });

  it("resets to the default dashboard after confirming", async () => {
    const header = await renderDashboard();
    useDashboardStore.getState().removeWidget("kpi-trips");
    await userEvent.click(
      header.getByRole("button", { name: "Voltar ao padrão" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Voltar ao dashboard padrão?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Voltar ao padrão" }),
    );
    expect(useDashboardStore.getState().state).toEqual(
      createDefaultDashboard(),
    );
  });

  it("toggles the theme and picks a palette", async () => {
    const header = await renderDashboard();
    await userEvent.click(
      header.getByRole("button", { name: "Usar tema claro" }),
    );
    expect(document.documentElement.dataset.theme).toBe("light");

    await userEvent.click(
      header.getByRole("button", { name: "Paleta de cores" }),
    );
    const panel = screen.getByRole("dialog", { name: "Paleta de cores" });
    await userEvent.click(within(panel).getByRole("button", { name: "Ocean" }));
    expect(document.documentElement.dataset.palette).toBe("ocean");
    expect(
      screen.queryByRole("dialog", { name: "Paleta de cores" }),
    ).not.toBeInTheDocument();
  });

  it("mobile menu groups the actions; Escape closes it", async () => {
    const header = await renderDashboard();
    await userEvent.click(header.getByRole("button", { name: "Mais ações" }));
    const menu = screen.getByRole("dialog", { name: "Mais ações" });
    expect(
      within(menu).getByRole("button", { name: "Desfazer" }),
    ).toBeDisabled();
    await userEvent.click(
      within(menu).getByRole("button", { name: "Tema claro" }),
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Mais ações" })).toBeNull();
  });

  it("the add-widget button opens the gallery", async () => {
    const header = await renderDashboard();
    const [add] = header.getAllByRole("button", { name: /Adicionar widget/ });
    if (!add) throw new Error("missing add button");
    await userEvent.click(add);
    expect(useUiStore.getState().galleryOpen).toBe(true);
  });

  it("shows the attributions and the data period", async () => {
    await renderDashboard();
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText(/01\/10\/2024 a 30\/09\/2026/)).toBeInTheDocument();
    expect(
      footer.getByRole("link", { name: "NYC Taxi & Limousine Commission" }),
    ).toBeInTheDocument();
    expect(
      footer.getByRole("link", { name: "OpenStreetMap contributors" }),
    ).toBeInTheDocument();
  });
});
