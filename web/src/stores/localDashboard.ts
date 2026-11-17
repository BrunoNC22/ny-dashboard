import {
  createDefaultDashboard,
  type DashboardState,
  dashboardStateSchema,
} from "@ny-dashboard/shared";

/** Visitor dashboard in localStorage (CLAUDE.md §6.5). Always wrapped in try/catch. */
export const LOCAL_DASHBOARD_KEY = "nyd:dashboard:v1";

export const loadLocalDashboard = (): DashboardState | null => {
  try {
    const raw = localStorage.getItem(LOCAL_DASHBOARD_KEY);
    if (!raw) return null;
    const parsed = dashboardStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveLocalDashboard = (state: DashboardState): void => {
  try {
    localStorage.setItem(LOCAL_DASHBOARD_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: the visitor just loses persistence
  }
};

export const clearLocalDashboard = (): void => {
  try {
    localStorage.removeItem(LOCAL_DASHBOARD_KEY);
  } catch {
    // ignore
  }
};

/** True if the state differs from the default dashboard (worth offering an import). */
export const isCustomized = (state: DashboardState): boolean =>
  JSON.stringify(state) !== JSON.stringify(createDefaultDashboard());
