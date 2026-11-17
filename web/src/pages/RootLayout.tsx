import { Outlet } from "react-router";

import { Toaster } from "../components/ui";
import { usePreferencesSync } from "../stores/usePreferencesSync";

/** Page chrome shared by every route: backdrop, toasts and theme/palette sync. */
export function RootLayout() {
  usePreferencesSync();
  return (
    <>
      <div className="page-backdrop" aria-hidden />
      <Outlet />
      <Toaster />
    </>
  );
}
