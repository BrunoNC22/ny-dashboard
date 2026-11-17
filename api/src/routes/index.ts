import { Router } from "express";

import {
  createAuthController,
  type SessionCookieConfig,
} from "../controllers/authController";
import {
  createDashboardController,
  dashboardSchemas,
} from "../controllers/dashboardController";
import { getHealth } from "../controllers/healthController";
import { createMetaController } from "../controllers/metaController";
import { createQueryController } from "../controllers/queryController";
import type { TokenService } from "../lib/tokens";
import { createAuthMiddlewares } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import type {
  DashboardRepository,
  PreferencesRepository,
} from "../models/dashboardRepository";
import type { DataRepository } from "../models/dataRepository";
import type { QueryRepository } from "../models/queryRepository";
import type { UserRepository } from "../models/userRepository";
import { createAuthService } from "../services/authService";
import {
  createDashboardService,
  createPreferencesService,
} from "../services/dashboardService";
import { createKpiService } from "../services/kpiService";
import { createMetaService } from "../services/metaService";
import { createTimeseriesService } from "../services/timeseriesService";
import { createAuthRouter } from "./auth";
import { createQueryRouter } from "./query";

/** Everything the routes need (real implementations in server.ts, fakes in unit tests). */
export interface ApiDependencies {
  tokens: TokenService;
  cookie: SessionCookieConfig;
  repositories: {
    users: UserRepository;
    dashboards: DashboardRepository;
    preferences: PreferencesRepository;
    data: DataRepository;
    queries: QueryRepository;
  };
  /** Path of taxi_zones.geojson served by /api/zones. */
  zonesGeoJsonPath: string;
  /** Called when a stored dashboard is no longer valid (it is replaced by the default). */
  onInvalidDashboard?: (userId: string) => void;
}

/** All routes under `/api`: wires repositories → services → controllers. */
export const createApiRouter = (deps: ApiDependencies): Router => {
  const router = Router();
  const auth = createAuthMiddlewares(deps.tokens);
  const { users, dashboards, preferences, data, queries } = deps.repositories;

  const authController = createAuthController(
    createAuthService(users, deps.tokens),
    deps.cookie,
  );
  const dashboardController = createDashboardController(
    createDashboardService(dashboards, deps.onInvalidDashboard),
    createPreferencesService(preferences),
  );

  const metaController = createMetaController(
    createMetaService(data, deps.zonesGeoJsonPath),
  );

  router.get("/health", getHealth);
  router.get("/meta", metaController.getMeta);
  router.get("/zones", metaController.getZones);

  const queryController = createQueryController({
    timeseries: createTimeseriesService(queries),
    kpi: createKpiService(queries),
  });
  router.use("/query", createQueryRouter(queryController));
  router.use("/auth", createAuthRouter(authController, auth));

  router.get("/dashboard", auth.requireAuth, dashboardController.getDashboard);
  router.put(
    "/dashboard",
    auth.requireAuth,
    validate(dashboardSchemas.saveDashboard),
    dashboardController.saveDashboard,
  );
  router.get(
    "/preferences",
    auth.requireAuth,
    dashboardController.getPreferences,
  );
  router.put(
    "/preferences",
    auth.requireAuth,
    validate(dashboardSchemas.savePreferences),
    dashboardController.savePreferences,
  );
  return router;
};
