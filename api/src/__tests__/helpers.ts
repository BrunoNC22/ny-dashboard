import { randomUUID } from "node:crypto";

import { pino } from "pino";

import { type AppDependencies, createApp } from "../app";
import { conflict } from "../lib/errors";
import { createTokenService } from "../lib/tokens";
import type { UserRecord, UserRepository } from "../models/userRepository";

/** Logger that discards everything (keeps test output clean). */
export const silentLogger = pino({ level: "silent" });

export const TEST_JWT_SECRET = "test-secret-with-enough-length";

/** In-memory user repository with the same contract as the Prisma one. */
export const createMemoryUserRepository = (): UserRepository & {
  users: UserRecord[];
} => {
  const users: UserRecord[] = [];
  return {
    users,
    findByUsername: (username) =>
      Promise.resolve(users.find((u) => u.username === username) ?? null),
    findById: (id) => Promise.resolve(users.find((u) => u.id === id) ?? null),
    createWithDefaults(username, passwordHash) {
      if (users.some((u) => u.username === username)) {
        return Promise.reject(conflict("Este nome de usuário já está em uso"));
      }
      const user = { id: randomUUID(), username, passwordHash };
      users.push(user);
      return Promise.resolve(user);
    },
  };
};

/** App wired with in-memory repositories (no database). */
export const createTestApp = (overrides: Partial<AppDependencies> = {}) => {
  const users = createMemoryUserRepository();
  const deps: AppDependencies = {
    logger: silentLogger,
    tokens: createTokenService(TEST_JWT_SECRET, "1h"),
    cookie: { secure: false, maxAgeMs: 3_600_000 },
    repositories: { users },
    ...overrides,
  };
  return { app: createApp(deps), deps, users };
};
