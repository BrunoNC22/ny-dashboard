import { createDefaultDashboard } from "@ny-dashboard/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { UserMenu } from "../components/auth/UserMenu";
import { routes } from "../routes";
import { useDashboardStore } from "../stores/dashboardStore";
import { LOCAL_DASHBOARD_KEY } from "../stores/localDashboard";
import { LOCAL_PREFERENCES_KEY } from "../stores/localPreferences";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Route = (init: RequestInit) => Response;
let routesMock: Record<string, Route>;
const calls: { url: string; init: RequestInit }[] = [];

const fetchMock = vi.fn((url: string, init: RequestInit) => {
  calls.push({ url, init });
  const handler = routesMock[`${init.method ?? "GET"} ${url}`];
  return Promise.resolve(
    handler
      ? handler(init)
      : json({ error: { code: "NOT_FOUND", message: url } }, 404),
  );
});

const visitor = () =>
  json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401);
const ana = () => json({ user: { id: "u1", username: "ana" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  calls.length = 0;
  localStorage.clear();
  routesMock = { "GET /api/auth/me": visitor };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

describe("login page", () => {
  it("validates on the client with the shared schema", async () => {
    renderAt("/login");
    await userEvent.type(screen.getByLabelText("Usuário"), "ab");
    await userEvent.type(screen.getByLabelText("Senha"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByText(/3 a 32 caracteres/)).toBeInTheDocument();
    expect(screen.getByText(/pelo menos 8 caracteres/)).toBeInTheDocument();
    expect(calls.some((c) => c.url === "/api/auth/login")).toBe(false);
  });

  it("shows the API error for wrong credentials", async () => {
    routesMock["POST /api/auth/login"] = () =>
      json({ error: { code: "INVALID_CREDENTIALS", message: "x" } }, 401);
    renderAt("/login");
    await userEvent.type(screen.getByLabelText("Usuário"), "demo");
    await userEvent.type(screen.getByLabelText("Senha"), "errada123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuário ou senha inválidos.",
    );
  });

  it("goes to the dashboard after signing in when there is nothing to import", async () => {
    routesMock["POST /api/auth/login"] = ana;
    const router = renderAt("/login");
    await userEvent.type(screen.getByLabelText("Usuário"), "ana");
    await userEvent.type(screen.getByLabelText("Senha"), "senha1234");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });
});

describe("register page", () => {
  it("requires the confirmation to match and reports taken usernames", async () => {
    routesMock["POST /api/auth/register"] = () =>
      json({ error: { code: "CONFLICT", message: "x" } }, 409);
    renderAt("/cadastro");
    await userEvent.type(screen.getByLabelText("Usuário"), "ana");
    await userEvent.type(screen.getByLabelText("Senha"), "senha1234");
    await userEvent.type(screen.getByLabelText("Confirmar senha"), "outra1234");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByText("As senhas não conferem.")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Confirmar senha"));
    await userEvent.type(screen.getByLabelText("Confirmar senha"), "senha1234");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este nome de usuário já está em uso.",
    );
  });
});

describe("importing the visitor dashboard", () => {
  const customize = () => {
    const local = createDefaultDashboard();
    local.filters.services = ["green"];
    localStorage.setItem(LOCAL_DASHBOARD_KEY, JSON.stringify(local));
    localStorage.setItem(
      LOCAL_PREFERENCES_KEY,
      JSON.stringify({ theme: "light", palette: "sunset" }),
    );
    return local;
  };

  const signIn = async () => {
    routesMock["POST /api/auth/login"] = ana;
    const router = renderAt("/login");
    await userEvent.type(screen.getByLabelText("Usuário"), "ana");
    await userEvent.type(screen.getByLabelText("Senha"), "senha1234");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("dialog", {
      name: "Importar o dashboard deste navegador?",
    });
    return router;
  };

  it("imports dashboard and preferences into the account", async () => {
    const local = customize();
    routesMock["PUT /api/dashboard"] = (init) =>
      json({
        ...(JSON.parse(init.body as string) as object),
        updatedAt: "2026-11-17T10:00:00.000Z",
      });
    routesMock["PUT /api/preferences"] = (init) =>
      json({
        preferences: JSON.parse(init.body as string) as object,
        updatedAt: "2026-11-17T10:00:00.000Z",
      });
    const router = await signIn();
    await userEvent.click(screen.getByRole("button", { name: "Importar" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    const put = calls.find(
      (c) => c.url === "/api/dashboard" && c.init.method === "PUT",
    );
    expect(JSON.parse(put?.init.body as string)).toEqual({ state: local });
    expect(
      calls.some(
        (c) => c.url === "/api/preferences" && c.init.method === "PUT",
      ),
    ).toBe(true);
    expect(useDashboardStore.getState().state.filters.services).toEqual([
      "green",
    ]);
    expect(localStorage.getItem(LOCAL_DASHBOARD_KEY)).toBeNull();
    expect(localStorage.getItem(LOCAL_PREFERENCES_KEY)).toBeNull();
  });

  it("keeps the account's dashboard and discards the local copy", async () => {
    customize();
    const router = await signIn();
    await userEvent.click(
      screen.getByRole("button", { name: "Manter o da conta" }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(calls.some((c) => c.init.method === "PUT")).toBe(false);
    expect(localStorage.getItem(LOCAL_DASHBOARD_KEY)).toBeNull();
  });
});

describe("user menu", () => {
  const renderMenu = () => {
    const router = createMemoryRouter([{ path: "*", element: <UserMenu /> }]);
    render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  };

  it("offers sign-in links to visitors", async () => {
    renderMenu();
    expect(await screen.findByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "/cadastro",
    );
  });

  it("signs out and goes back to the visitor dashboard", async () => {
    routesMock["GET /api/auth/me"] = ana;
    routesMock["POST /api/auth/logout"] = () =>
      new Response(null, { status: 204 });
    const state = createDefaultDashboard();
    state.filters.services = ["fhvhv"];
    useDashboardStore.getState().hydrate(state);
    renderMenu();
    expect(await screen.findByText("ana")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    await screen.findByRole("link", { name: "Entrar" });
    expect(useDashboardStore.getState().state).toEqual(
      createDefaultDashboard(),
    );
  });
});
