import { join } from "node:path";

import type { Logger } from "pino";

import type { AppDependencies } from "./app";
import { durationToMs, type Env } from "./config/env";
import { ZONES_DIR } from "./lib/paths";
import type { Db } from "./lib/prisma";
import { createTokenService } from "./lib/tokens";
import {
  createPrismaDashboardRepository,
  createPrismaPreferencesRepository,
} from "./models/dashboardRepository";
import { createPrismaDataRepository } from "./models/dataRepository";
import { createPrismaQueryRepository } from "./models/queryRepository";
import { createPrismaUserRepository } from "./models/userRepository";

/** Production wiring of the app (used by server.ts and by the integration tests). */
export const createDependencies = (
  prisma: Db,
  env: Pick<Env, "JWT_SECRET" | "JWT_EXPIRES_IN" | "COOKIE_SECURE">,
  logger: Logger,
): AppDependencies => ({
  logger,
  tokens: createTokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN),
  cookie: {
    secure: env.COOKIE_SECURE,
    maxAgeMs: durationToMs(env.JWT_EXPIRES_IN),
  },
  repositories: {
    users: createPrismaUserRepository(prisma),
    dashboards: createPrismaDashboardRepository(prisma),
    preferences: createPrismaPreferencesRepository(prisma),
    data: createPrismaDataRepository(prisma),
    queries: createPrismaQueryRepository(prisma),
  },
  zonesGeoJsonPath: join(ZONES_DIR, "taxi_zones.geojson"),
  onInvalidDashboard: (userId) => {
    logger.warn(
      { userId },
      "stored dashboard is invalid; serving the default dashboard",
    );
  },
});
