import { Outlet } from "react-router";

import { Toaster } from "../components/ui";

/** Page chrome shared by every route: animated backdrop + toasts. */
export function RootLayout() {
  return (
    <>
      <div className="page-backdrop" aria-hidden />
      <Outlet />
      <Toaster />
    </>
  );
}
