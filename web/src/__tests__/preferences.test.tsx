import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_PREFERENCES, PALETTES, THEMES } from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { LOCAL_PREFERENCES_KEY } from "../stores/localPreferences";
import {
  APPEARANCE_KEY,
  usePreferencesStore,
} from "../stores/preferencesStore";
import {
  PREFERENCES_SAVE_DELAY_MS,
  usePreferencesSync,
} from "../stores/usePreferencesSync";

const store = () => usePreferencesStore.getState();
const html = () => document.documentElement.dataset;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let loggedIn = false;
let server = { theme: "light", palette: "ocean" };
let updatedAt = "2026-11-17T10:00:00.000Z";
const puts: unknown[] = [];

const fetchMock = vi.fn((url: string, init: RequestInit) => {
  if (url === "/api/auth/me") {
    return Promise.resolve(
      loggedIn
        ? json({ user: { id: "u1", username: "ana" } })
        : json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401),
    );
  }
  if (init.method === "PUT") {
    const body = JSON.parse(init.body as string) as typeof server;
    puts.push(body);
    server = body;
    updatedAt = new Date(Date.parse(updatedAt) + 1000).toISOString();
  }
  return Promise.resolve(json({ preferences: server, updatedAt }));
});

const setup = () => {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(
      () => {
        usePreferencesSync();
      },
      { wrapper },
    ),
  };
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  loggedIn = false;
  server = { theme: "light", palette: "ocean" };
  puts.length = 0;
  usePreferencesStore.setState({
    preferences: DEFAULT_PREFERENCES,
    revision: 0,
    dirty: false,
    locked: false,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("preferences store", () => {
  it("applies changes to <html> and remembers the appearance", () => {
    store().setPalette("sunset");
    store().toggleTheme();
    expect(html()).toMatchObject({ theme: "light", palette: "sunset" });
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? "")).toEqual({
      theme: "light",
      palette: "sunset",
    });
    expect(store()).toMatchObject({ revision: 2, dirty: true });
  });

  it("a dev override is never replaced by synced preferences", () => {
    store().lock({ theme: "light", palette: "neon" });
    store().hydrate({ theme: "dark", palette: "mono" });
    expect(html()).toMatchObject({ theme: "light", palette: "neon" });
  });
});

describe("usePreferencesSync", () => {
  it("visitor: loads from and saves to localStorage", async () => {
    localStorage.setItem(
      LOCAL_PREFERENCES_KEY,
      JSON.stringify({ theme: "light", palette: "forest" }),
    );
    setup();
    await waitFor(() => {
      expect(html()).toMatchObject({ theme: "light", palette: "forest" });
    });
    act(() => {
      store().setPalette("mono");
    });
    expect(
      JSON.parse(localStorage.getItem(LOCAL_PREFERENCES_KEY) ?? ""),
    ).toEqual({ theme: "light", palette: "mono" });
    expect(puts).toHaveLength(0);
  });

  it("signed in: applies the account's preferences and saves changes once", async () => {
    loggedIn = true;
    setup();
    await waitFor(() => {
      expect(html()).toMatchObject({ theme: "light", palette: "ocean" });
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => {
      store().setPalette("neon");
      store().setPalette("aurora");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREFERENCES_SAVE_DELAY_MS + 50);
    });
    expect(puts).toEqual([{ theme: "light", palette: "aurora" }]);
    await waitFor(() => {
      expect(store().dirty).toBe(false);
    });
    expect(localStorage.getItem(LOCAL_PREFERENCES_KEY)).toBeNull();
  });

  it("follows changes made on another device (focus refetch)", async () => {
    loggedIn = true;
    const { client } = setup();
    await waitFor(() => {
      expect(html().palette).toBe("ocean");
    });
    server = { theme: "dark", palette: "sunset" };
    updatedAt = "2026-11-17T12:00:00.000Z";
    await act(() => client.refetchQueries({ queryKey: ["preferences"] }));
    await waitFor(() => {
      expect(html()).toMatchObject({ theme: "dark", palette: "sunset" });
    });
  });
});

describe("index.html inline script", () => {
  const source = readFileSync(resolve(__dirname, "../../index.html"), "utf8");

  it("reads the appearance key and accepts exactly the shared themes and palettes", () => {
    expect(source).toContain(`"${APPEARANCE_KEY}"`);
    expect(source).toContain(`/^(${THEMES.join("|")})$/`);
    expect(source).toContain(`/^(${PALETTES.join("|")})$/`);
  });
});
