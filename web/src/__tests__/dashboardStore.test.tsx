import {
  createDefaultDashboard,
  dashboardStateSchema,
  type WidgetConfig,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { HISTORY_LIMIT, useDashboardStore } from "../stores/dashboardStore";
import {
  loadLocalDashboard,
  LOCAL_DASHBOARD_KEY,
} from "../stores/localDashboard";
import {
  AUTOSAVE_DELAY_MS,
  useDashboardSync,
  useSaveStatus,
} from "../stores/useDashboardSync";

const initial = useDashboardStore.getState();
const store = () => useDashboardStore.getState();
const valid = () => {
  const result = dashboardStateSchema.safeParse(store().state);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

const kpi: WidgetConfig = {
  id: "kpi-new",
  type: "kpi",
  title: "Novo KPI",
  metric: "revenue",
  sparkline: false,
  evaluation: {
    comparison: { enabled: true, neutralBandPct: 2 },
    target: null,
  },
};

beforeEach(() => {
  useDashboardStore.setState({
    ...initial,
    state: createDefaultDashboard(),
    past: [],
    future: [],
    dirty: false,
    revision: 0,
  });
  localStorage.clear();
});

describe("dashboard store", () => {
  it("adds a widget at the bottom of BOTH layouts and stays valid", () => {
    store().addWidget(kpi, { desktop: { w: 3, h: 3 }, mobile: { w: 1, h: 3 } });
    const { state } = store();
    expect(state.widgets.at(-1)?.id).toBe("kpi-new");
    const desktop = state.layouts.desktop.find((i) => i.i === "kpi-new");
    const mobile = state.layouts.mobile.find((i) => i.i === "kpi-new");
    expect(desktop).toMatchObject({ x: 0, w: 3, h: 3, y: 41 }); // below the last default widget
    expect(mobile).toMatchObject({ x: 0, w: 1, h: 3, y: 72 });
    expect(valid()).toEqual([]);
    expect(store()).toMatchObject({ dirty: true, revision: 1 });
  });

  it("changes one breakpoint's layout without touching the other", () => {
    const mobileBefore = structuredClone(store().state.layouts.mobile);
    const desktop = store().state.layouts.desktop.map((item) =>
      item.i === "kpi-trips" ? { ...item, w: 4 } : item,
    );
    store().updateLayout("desktop", desktop);
    expect(
      store().state.layouts.desktop.find((i) => i.i === "kpi-trips")?.w,
    ).toBe(4);
    expect(store().state.layouts.mobile).toEqual(mobileBefore);
  });

  it("ignores layout callbacks that change nothing (no history spam)", () => {
    store().updateLayout(
      "mobile",
      structuredClone(store().state.layouts.mobile).reverse(),
    );
    expect(store().past).toHaveLength(0);
    expect(store().revision).toBe(0);
  });

  it("removes and duplicates widgets across both layouts", () => {
    store().removeWidget("map-routes");
    expect(store().state.widgets.some((w) => w.id === "map-routes")).toBe(
      false,
    );
    expect(store().state.layouts.mobile.some((i) => i.i === "map-routes")).toBe(
      false,
    );

    const copyId = store().duplicateWidget("kpi-revenue");
    expect(copyId).toMatch(/^kpi-/);
    const copy = store().state.layouts.desktop.find((i) => i.i === copyId);
    expect(copy).toMatchObject({ w: 2, h: 3 }); // same size as the original
    expect(store().state.widgets.find((w) => w.id === copyId)?.title).toBe(
      "Receita",
    );
    expect(valid()).toEqual([]);
  });

  it("undoes and redoes, and a new edit clears the redo stack", () => {
    store().setFilters({ services: ["fhvhv"] });
    store().removeWidget("kpi-trips");
    store().undo();
    expect(store().state.widgets.some((w) => w.id === "kpi-trips")).toBe(true);
    store().undo();
    expect(store().state.filters.services).toEqual([]);
    store().redo();
    expect(store().state.filters.services).toEqual(["fhvhv"]);
    store().setFilters({ boroughs: ["queens"] });
    expect(store().future).toEqual([]);
  });

  it("keeps at most 50 history steps", () => {
    for (let i = 0; i < HISTORY_LIMIT + 10; i++)
      store().setFilters({ services: i % 2 ? ["green"] : ["yellow"] });
    expect(store().past).toHaveLength(HISTORY_LIMIT);
  });

  it("resets to the default dashboard as an undoable edit", () => {
    store().removeWidget("kpi-trips");
    store().resetToDefault();
    expect(store().state).toEqual(createDefaultDashboard());
    store().undo();
    expect(store().state.widgets.some((w) => w.id === "kpi-trips")).toBe(false);
  });

  it("hydrate replaces the state without history; markSaved respects newer edits", () => {
    store().setFilters({ services: ["green"] });
    store().hydrate(createDefaultDashboard());
    expect(store()).toMatchObject({ past: [], dirty: false });
    store().setFilters({ services: ["green"] }); // revision 2
    store().markSaved(1);
    expect(store().dirty).toBe(true);
    store().markSaved(2);
    expect(store().dirty).toBe(false);
  });
});

// ── Sync ────────────────────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("useDashboardSync", () => {
  let serverState = createDefaultDashboard();
  let updatedAt = "2026-11-17T10:00:00.000Z";
  let loggedIn = true;
  const puts: unknown[] = [];

  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    if (url === "/api/auth/me") {
      return Promise.resolve(
        loggedIn
          ? json({ user: { id: "u1", username: "ana" } })
          : json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401),
      );
    }
    if (url === "/api/dashboard" && init.method === "PUT") {
      puts.push(JSON.parse(init.body as string));
      updatedAt = new Date(Date.parse(updatedAt) + 1000).toISOString();
      return Promise.resolve(
        json({
          state: (JSON.parse(init.body as string) as { state: unknown }).state,
          updatedAt,
        }),
      );
    }
    return Promise.resolve(json({ state: serverState, updatedAt }));
  });

  const setup = () => {
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, ...renderHook(() => useDashboardSync(), { wrapper }) };
  };

  const flush = async (ms = 0) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", fetchMock);
    serverState = createDefaultDashboard();
    serverState.filters.services = ["yellow"];
    updatedAt = "2026-11-17T10:00:00.000Z";
    loggedIn = true;
    puts.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("logged in: hydrates from the server and autosaves once after the edits settle", async () => {
    const { result } = setup();
    await flush(10);
    expect(result.current.ready).toBe(true);
    expect(store().state.filters.services).toEqual(["yellow"]);

    act(() => {
      store().setFilters({ services: ["green"] });
    });
    await flush(300);
    act(() => {
      store().setFilters({ services: ["fhvhv"] });
    });
    await flush(AUTOSAVE_DELAY_MS - 100);
    expect(puts).toHaveLength(0); // still debouncing
    await flush(200);
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      state: { filters: { services: ["fhvhv"] } },
    });
    expect(store().dirty).toBe(false);
    expect(useSaveStatus.getState().status).toBe("saved");
  });

  it("does not overwrite unsaved local edits with server data", async () => {
    const { client } = setup();
    await flush(10);
    act(() => {
      store().setFilters({ boroughs: ["bronx"] });
    });
    // another device saved meanwhile → the focus refetch brings newer data
    serverState.filters.services = ["green"];
    updatedAt = "2026-11-17T12:00:00.000Z";
    await act(() => client.refetchQueries({ queryKey: ["dashboard"] }));
    expect(store().state.filters.boroughs).toEqual(["bronx"]);
    expect(store().state.filters.services).toEqual(["yellow"]);
  });

  it("visitor: hydrates from and saves to localStorage", async () => {
    loggedIn = false;
    const local = createDefaultDashboard();
    local.filters.services = ["green"];
    localStorage.setItem(LOCAL_DASHBOARD_KEY, JSON.stringify(local));
    setup();
    await flush(10);
    expect(store().state.filters.services).toEqual(["green"]);
    expect(useSaveStatus.getState().status).toBe("local");

    act(() => {
      store().setFilters({ services: ["fhvhv"] });
    });
    await flush(10);
    expect(loadLocalDashboard()?.filters.services).toEqual(["fhvhv"]);
    expect(puts).toHaveLength(0);
  });
});
