import {
  createDefaultDashboard,
  type DashboardResponse,
  type DashboardState,
  dashboardStateSchema,
  DEFAULT_PREFERENCES,
  type Preferences,
  type PreferencesResponse,
  preferencesSchema,
} from "@ny-dashboard/shared";

import type {
  DashboardRepository,
  PreferencesRepository,
} from "../models/dashboardRepository";
import {
  toDashboardResponse,
  toPreferencesResponse,
} from "../views/dashboardView";

export interface DashboardService {
  get(userId: string): Promise<DashboardResponse>;
  save(userId: string, state: DashboardState): Promise<DashboardResponse>;
}

export interface PreferencesService {
  get(userId: string): Promise<PreferencesResponse>;
  save(userId: string, preferences: Preferences): Promise<PreferencesResponse>;
}

/**
 * The stored state is validated on read: if it is missing or no longer valid (e.g. after a
 * schema change), the default dashboard is returned instead of failing.
 */
export const createDashboardService = (
  dashboards: DashboardRepository,
  onInvalid: (userId: string) => void = () => undefined,
): DashboardService => ({
  async get(userId) {
    const stored = await dashboards.findByUser(userId);
    if (!stored)
      return toDashboardResponse(
        await dashboards.save(userId, createDefaultDashboard()),
      );
    const parsed = dashboardStateSchema.safeParse(stored.state);
    if (parsed.success)
      return toDashboardResponse({ ...stored, state: parsed.data });
    onInvalid(userId);
    return toDashboardResponse({
      state: createDefaultDashboard(),
      updatedAt: stored.updatedAt,
    });
  },
  async save(userId, state) {
    return toDashboardResponse(await dashboards.save(userId, state));
  },
});

export const createPreferencesService = (
  preferences: PreferencesRepository,
): PreferencesService => ({
  async get(userId) {
    const stored = await preferences.findByUser(userId);
    if (!stored)
      return toPreferencesResponse(
        await preferences.save(userId, DEFAULT_PREFERENCES),
      );
    const parsed = preferencesSchema.safeParse({
      theme: stored.theme,
      palette: stored.palette,
    });
    return toPreferencesResponse({
      ...(parsed.success ? parsed.data : DEFAULT_PREFERENCES),
      updatedAt: stored.updatedAt,
    });
  },
  async save(userId, value) {
    return toPreferencesResponse(await preferences.save(userId, value));
  },
});
