import { randomUUID } from "node:crypto";

import {
  createDefaultDashboard,
  DEFAULT_PREFERENCES,
} from "@ny-dashboard/shared";
import { pino } from "pino";

import { type AppDependencies, createApp } from "../app";
import { conflict } from "../lib/errors";
import { createTokenService } from "../lib/tokens";
import type {
  DashboardRepository,
  PreferencesRepository,
  StoredDashboard,
  StoredPreferences,
} from "../models/dashboardRepository";
import type { UserRecord, UserRepository } from "../models/userRepository";

/** Logger that discards everything (keeps test output clean). */
export const silentLogger = pino({ level: "silent" });

export const TEST_JWT_SECRET = "test-secret-with-enough-length";

/** Strictly increasing timestamps (saves within the same millisecond stay ordered). */
const clock = () => {
  let last = 0;
  return () => new Date((last = Math.max(Date.now(), last + 1)));
};

/**
 * In-memory repositories with the same contracts as the Prisma ones: creating a user also
 * creates its preferences and the default dashboard.
 */
export const createMemoryRepositories = () => {
  const now = clock();
  const users: UserRecord[] = [];
  const dashboards = new Map<string, StoredDashboard>();
  const preferences = new Map<string, StoredPreferences>();

  const userRepository: UserRepository = {
    findByUsername: (username) =>
      Promise.resolve(users.find((u) => u.username === username) ?? null),
    findById: (id) => Promise.resolve(users.find((u) => u.id === id) ?? null),
    createWithDefaults(username, passwordHash, prefs = DEFAULT_PREFERENCES) {
      if (users.some((u) => u.username === username)) {
        return Promise.reject(conflict("Este nome de usuário já está em uso"));
      }
      const user = { id: randomUUID(), username, passwordHash };
      users.push(user);
      dashboards.set(user.id, {
        state: createDefaultDashboard(),
        updatedAt: now(),
      });
      preferences.set(user.id, { ...prefs, updatedAt: now() });
      return Promise.resolve(user);
    },
  };

  const dashboardRepository: DashboardRepository = {
    findByUser: (userId) => Promise.resolve(dashboards.get(userId) ?? null),
    save(userId, state) {
      const stored = { state: structuredClone(state), updatedAt: now() };
      dashboards.set(userId, stored);
      return Promise.resolve(stored);
    },
  };

  const preferencesRepository: PreferencesRepository = {
    findByUser: (userId) => Promise.resolve(preferences.get(userId) ?? null),
    save(userId, value) {
      const stored = { ...value, updatedAt: now() };
      preferences.set(userId, stored);
      return Promise.resolve(stored);
    },
  };

  return {
    data: { users, dashboards, preferences },
    repositories: {
      users: userRepository,
      dashboards: dashboardRepository,
      preferences: preferencesRepository,
    },
  };
};

/** In-memory user repository (kept for focused auth tests). */
export const createMemoryUserRepository = (): UserRepository & {
  users: UserRecord[];
} => {
  const { data, repositories } = createMemoryRepositories();
  return { ...repositories.users, users: data.users };
};

/** App wired with in-memory repositories (no database). */
export const createTestApp = (overrides: Partial<AppDependencies> = {}) => {
  const memory = createMemoryRepositories();
  const deps: AppDependencies = {
    logger: silentLogger,
    tokens: createTokenService(TEST_JWT_SECRET, "1h"),
    cookie: { secure: false, maxAgeMs: 3_600_000 },
    repositories: memory.repositories,
    ...overrides,
  };
  return { app: createApp(deps), deps, data: memory.data };
};
