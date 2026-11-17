import {
  createDefaultDashboard,
  type TimeseriesRequest,
} from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, apiFetch, ApiRequestError, isApiError } from "../api/client";
import {
  queryKeys,
  useDashboard,
  useLogin,
  useLogout,
  useMe,
  useSaveDashboard,
  useTimeseries,
} from "../api/hooks";
import { createQueryClient } from "../api/queryClient";

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let handler: Handler;
const fetchMock = vi.fn((url: string, init: RequestInit) =>
  Promise.resolve(handler(url, init)),
);

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const wrapperWith = () => {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retry: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

const dashboard = {
  state: createDefaultDashboard(),
  updatedAt: "2026-11-17T10:00:00.000Z",
};

describe("apiFetch", () => {
  it("sends JSON with the same-origin cookie and parses the response", async () => {
    handler = () => json({ ok: true });
    await expect(
      apiFetch("/api/x", { method: "POST", body: { a: 1 } }),
    ).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/x");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      body: '{"a":1}',
    });
  });

  it("turns the standard error body into ApiRequestError", async () => {
    handler = () =>
      json({ error: { code: "CONFLICT", message: "Usuário já existe" } }, 409);
    const error = await apiFetch("/api/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Usuário já existe",
    });
    expect(isApiError(error, "CONFLICT")).toBe(true);
  });

  it("handles 204, unknown error bodies and network failures", async () => {
    handler = () => new Response(null, { status: 204 });
    await expect(
      apiFetch("/api/auth/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
    handler = () => new Response("<html>", { status: 502 });
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      status: 502,
      code: "HTTP_ERROR",
    });
    handler = () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("validates responses with the shared schemas", async () => {
    handler = () => json({ user: { id: 1 } });
    await expect(
      api.login({ username: "ana", password: "senha1234" }),
    ).rejects.toThrow();
  });
});

describe("session hooks", () => {
  it("useMe returns null for visitors (401) instead of an error", async () => {
    handler = () =>
      json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401);
    const { wrapper } = wrapperWith();
    const { result } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("login stores the user and logout clears user data", async () => {
    const { client, wrapper } = wrapperWith();
    client.setQueryData(queryKeys.dashboard, dashboard);
    handler = (url) =>
      url.endsWith("/login")
        ? json({ user: { id: "u1", username: "ana" } })
        : new Response(null, { status: 204 });
    const { result } = renderHook(
      () => ({ login: useLogin(), logout: useLogout() }),
      { wrapper },
    );
    await act(() =>
      result.current.login.mutateAsync({
        username: "ana",
        password: "senha1234",
      }),
    );
    expect(client.getQueryData(queryKeys.me)).toEqual({
      id: "u1",
      username: "ana",
    });

    await act(() => result.current.logout.mutateAsync());
    expect(client.getQueryData(queryKeys.me)).toBeNull();
    expect(client.getQueryData(queryKeys.dashboard)).toBeUndefined();
  });
});

describe("dashboard hooks", () => {
  it("refetches on window focus and updates the cache after saving", async () => {
    handler = (_url, init) =>
      json(
        init.method === "PUT"
          ? { ...dashboard, updatedAt: "2026-11-17T11:00:00.000Z" }
          : dashboard,
      );
    const { client, wrapper } = wrapperWith();
    const { result } = renderHook(
      () => ({ query: useDashboard(), save: useSaveDashboard() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.query.data?.updatedAt).toBe(dashboard.updatedAt);
    });
    const query = client
      .getQueryCache()
      .find({ queryKey: queryKeys.dashboard });
    expect(
      (query?.options as { refetchOnWindowFocus?: boolean })
        .refetchOnWindowFocus,
    ).toBe(true);

    await act(() => result.current.save.mutateAsync(createDefaultDashboard()));
    expect(
      client.getQueryData<typeof dashboard>(queryKeys.dashboard)?.updatedAt,
    ).toBe("2026-11-17T11:00:00.000Z");
  });
});

describe("data hooks", () => {
  it("posts the request and caches by its content", async () => {
    const response = {
      metric: "trips",
      granularity: "day",
      unit: "count",
      notices: [],
      notApplicable: false,
      series: [{ key: "total", points: { t: ["2026-09-01"], v: [10] } }],
      comparison: null,
      projection: null,
    };
    handler = () => json(response);
    const request: TimeseriesRequest = {
      metric: "trips",
      granularity: "day",
      filters: {
        period: { from: "2026-09-01", to: "2026-09-01" },
        services: [],
        companies: [],
        boroughs: [],
        zones: [],
      },
      comparison: { mode: "none" },
      includeProjection: false,
    };
    const { wrapper } = wrapperWith();
    const first = renderHook(() => useTimeseries(request), { wrapper });
    await waitFor(() => {
      expect(first.result.current.data?.series[0]?.points.v).toEqual([10]);
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body as string)).toEqual(
      request,
    );

    // same request (new object) → served from the cache
    renderHook(() => useTimeseries({ ...request }), { wrapper });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when disabled", () => {
    handler = () => json({});
    const { wrapper } = wrapperWith();
    renderHook(() => useDashboard({ enabled: false }), { wrapper });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
