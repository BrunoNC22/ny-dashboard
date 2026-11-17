import {
  createDefaultDashboard,
  type MetaResponse,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { FiltersBar } from "../components/filters/FiltersBar";
import {
  comparisonLabel,
  lastWholeMonth,
  monthRange,
  monthsBetween,
  periodLabel,
  rangeBefore,
  wholeMonth,
} from "../components/filters/periods";
import { useDashboardStore } from "../stores/dashboardStore";

describe("period helpers", () => {
  it("handles whole months, including leap years", () => {
    expect(monthRange("2026-09")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(monthRange("2024-02").to).toBe("2024-02-29");
    expect(wholeMonth({ from: "2026-08-01", to: "2026-08-31" })).toBe(
      "2026-08",
    );
    expect(wholeMonth({ from: "2026-08-01", to: "2026-08-30" })).toBeNull();
  });

  it("lists months and finds the last whole month of the coverage", () => {
    expect(monthsBetween({ from: "2025-11-15", to: "2026-02-03" })).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(lastWholeMonth({ from: "2024-10-01", to: "2026-09-30" })).toEqual(
      monthRange("2026-09"),
    );
    expect(lastWholeMonth({ from: "2024-10-01", to: "2026-10-12" })).toEqual(
      monthRange("2026-09"),
    );
  });

  it("formats labels in pt-BR", () => {
    expect(periodLabel(monthRange("2026-09"))).toBe("09/2026");
    expect(periodLabel({ from: "2026-09-01", to: "2026-09-15" })).toBe(
      "01/09/2026 – 15/09/2026",
    );
    expect(comparisonLabel({ mode: "previous_year" })).toBe("vs. ano anterior");
    expect(rangeBefore({ from: "2026-09-01", to: "2026-09-15" })).toEqual({
      from: "2026-08-17",
      to: "2026-08-31",
    });
  });
});

// ── Component ──────────────────────────────────────────────────────────────────

const meta: MetaResponse = {
  period: { from: "2025-01-01", to: "2026-09-30" },
  projection: { backtestFrom: "2025-02-01", until: "2026-12-31" },
  sampleMonth: "2026-09",
  services: [
    { id: "yellow", label: "Yellow Taxi" },
    { id: "green", label: "Green Taxi" },
    { id: "fhvhv", label: "Apps (Uber/Lyft)" },
  ],
  companies: [
    { id: "yellow", label: "Yellow", service: "yellow" },
    { id: "green", label: "Green", service: "green" },
    { id: "uber", label: "Uber", service: "fhvhv" },
    { id: "lyft", label: "Lyft", service: "fhvhv" },
  ],
  boroughs: [
    { id: "manhattan", label: "Manhattan" },
    { id: "queens", label: "Queens" },
  ],
  zones: [],
  dimensions: [],
  metrics: [],
};

const filters = () => useDashboardStore.getState().state.filters;

const renderBar = async () => {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FiltersBar />
    </QueryClientProvider>,
  );
  // wait for /api/meta: the borough list comes from it
  await userEvent.click(screen.getByRole("button", { name: /Distrito/ }));
  await waitFor(() => {
    expect(screen.queryByLabelText("Bronx")).toBeNull();
    expect(screen.getByLabelText("Queens")).toBeInTheDocument();
  });
  await userEvent.keyboard("{Escape}");
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(meta), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
  useDashboardStore.getState().hydrate(createDefaultDashboard());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FiltersBar", () => {
  it("shows the default period × previous period", async () => {
    await renderBar();
    expect(screen.getByRole("button", { name: /Período/ })).toHaveTextContent(
      "09/2026",
    );
    expect(
      screen.getByRole("button", { name: /Comparação/ }),
    ).toHaveTextContent("vs. período anterior");
  });

  it("picks a month inside the coverage only", async () => {
    await renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Período/ }));
    const panel = screen.getByRole("dialog", { name: "Período" });
    expect(
      within(panel).getByRole("button", { name: "out/2026" }),
    ).toBeDisabled();
    await userEvent.click(
      within(panel).getByRole("button", { name: "Ano anterior" }),
    );
    await userEvent.click(
      within(panel).getByRole("button", { name: "mar/2025" }),
    );
    expect(filters().period).toEqual(monthRange("2025-03"));
    expect(useDashboardStore.getState().dirty).toBe(true);
  });

  it("applies a custom range", async () => {
    await renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Período/ }));
    const panel = screen.getByRole("dialog", { name: "Período" });
    const from = within(panel).getByLabelText("De");
    await userEvent.clear(from);
    await userEvent.type(from, "2026-09-10");
    await userEvent.click(
      within(panel).getByRole("button", { name: "Aplicar" }),
    );
    expect(filters().period).toEqual({ from: "2026-09-10", to: "2026-09-30" });
  });

  it("changes the comparison; projection only inside its range", async () => {
    await renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Comparação/ }));
    let panel = screen.getByRole("dialog", { name: "Comparação" });
    await userEvent.click(
      within(panel).getByRole("radio", { name: /Projeção/ }),
    );
    expect(filters().comparison).toEqual({ mode: "projection" });

    useDashboardStore.getState().setFilters({ period: monthRange("2025-01") });
    await userEvent.click(screen.getByRole("button", { name: /Comparação/ }));
    panel = screen.getByRole("dialog", { name: "Comparação" });
    expect(
      within(panel).getByRole("radio", { name: /Projeção/ }),
    ).toBeDisabled();
    await userEvent.click(
      within(panel).getByRole("radio", { name: /Intervalo personalizado/ }),
    );
    expect(filters().comparison).toEqual({
      mode: "custom",
      range: { from: "2024-12-01", to: "2024-12-31" },
    });
  });

  it("enables the company filter only with the app trips and prunes it", async () => {
    await renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Empresa/ }));
    await userEvent.click(screen.getByLabelText("Uber"));
    expect(filters().companies).toEqual(["uber"]);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: /Serviço/ }));
    await userEvent.click(screen.getByLabelText("Yellow Taxi"));
    expect(filters()).toMatchObject({ services: ["yellow"], companies: [] });
    expect(screen.getByRole("button", { name: /Empresa/ })).toBeDisabled();
  });

  it("checking every option means no filter, and 'Limpar filtros' resets", async () => {
    await renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Distrito/ }));
    await userEvent.click(screen.getByLabelText("Manhattan"));
    expect(filters().boroughs).toEqual(["manhattan"]);
    await userEvent.click(screen.getByLabelText("Queens"));
    expect(filters().boroughs).toEqual([]);
    await userEvent.click(screen.getByLabelText("Queens"));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", { name: "Limpar filtros" }),
    );
    expect(filters().boroughs).toEqual([]);
  });
});
