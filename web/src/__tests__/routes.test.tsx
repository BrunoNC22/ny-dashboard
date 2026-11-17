import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import { routes } from "../routes";

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

beforeEach(() => {
  // visitor session for the pages that ask who is signed in
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
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("routes", () => {
  it("renders the dashboard at /", () => {
    renderAt("/");
    expect(
      screen.getByRole("heading", { name: "NY Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2024-10 → 2026-09/)).toBeInTheDocument();
  });

  it("navigates to the login and sign-up pages", async () => {
    const router = renderAt("/");
    await userEvent.click(screen.getByRole("link", { name: "Entrar" }));
    expect(router.state.location.pathname).toBe("/login");
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "NY Dashboard" }));
    await userEvent.click(screen.getByRole("link", { name: "Criar conta" }));
    expect(router.state.location.pathname).toBe("/cadastro");
  });

  it("shows a 404 page for unknown paths", () => {
    renderAt("/nao-existe");
    expect(screen.getByText("Página não encontrada")).toBeInTheDocument();
  });
});
