import type { RouteObject } from "react-router";

import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";

/** Application routes (pt-BR paths). */
export const routes: RouteObject[] = [
  { path: "/", element: <DashboardPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/cadastro", element: <RegisterPage /> },
  { path: "*", element: <NotFoundPage /> },
];
