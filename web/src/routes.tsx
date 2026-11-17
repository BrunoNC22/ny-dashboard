import type { RouteObject } from "react-router";

import { DashboardPage } from "./pages/DashboardPage";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RootLayout } from "./pages/RootLayout";

/** Application routes (pt-BR paths). `/_ds` (design system) only exists in development. */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/cadastro", element: <RegisterPage /> },
      ...(import.meta.env.DEV
        ? [{ path: "/_ds", element: <DesignSystemPage /> }]
        : []),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
