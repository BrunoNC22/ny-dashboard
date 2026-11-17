import type { DashboardState, Preferences } from "@ny-dashboard/shared";

import type { Db } from "../lib/prisma";

export interface StoredDashboard {
  /** Raw JSON as stored (validated by the service). */
  state: unknown;
  updatedAt: Date;
}

export interface StoredPreferences {
  theme: string;
  palette: string;
  updatedAt: Date;
}

/** One dashboard per user (CLAUDE.md §6.5). */
export interface DashboardRepository {
  findByUser(userId: string): Promise<StoredDashboard | null>;
  /** Creates or replaces the user's dashboard (last write wins). */
  save(userId: string, state: DashboardState): Promise<StoredDashboard>;
}

export interface PreferencesRepository {
  findByUser(userId: string): Promise<StoredPreferences | null>;
  save(userId: string, preferences: Preferences): Promise<StoredPreferences>;
}

export const createPrismaDashboardRepository = (
  prisma: Db,
): DashboardRepository => ({
  findByUser: (userId) =>
    prisma.dashboard.findUnique({
      where: { userId },
      select: { state: true, updatedAt: true },
    }),
  save: (userId, state) =>
    prisma.dashboard.upsert({
      where: { userId },
      create: { userId, state },
      update: { state },
      select: { state: true, updatedAt: true },
    }),
});

export const createPrismaPreferencesRepository = (
  prisma: Db,
): PreferencesRepository => ({
  findByUser: (userId) =>
    prisma.preferences.findUnique({
      where: { userId },
      select: { theme: true, palette: true, updatedAt: true },
    }),
  save: (userId, preferences) =>
    prisma.preferences.upsert({
      where: { userId },
      create: { userId, ...preferences },
      update: preferences,
      select: { theme: true, palette: true, updatedAt: true },
    }),
});
