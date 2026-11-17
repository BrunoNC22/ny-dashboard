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
import type { TokenService } from "../lib/tokens";
import { createAuthMiddlewares } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import type {
  DashboardRepository,
  PreferencesRepository,
} from "../models/dashboardRepository";
import type { UserRepository } from "../models/userRepository";
import { createAuthService } from "../services/authService";
import {
  createDashboardService,
  createPreferencesService,
} from "../services/dashboardService";
import { createAuthRouter } from "./auth";

/** Everything the routes need (real implementations in server.ts, fakes in unit tests). */
export interface ApiDependencies {
  tokens: TokenService;
  cookie: SessionCookieConfig;
  repositories: {
    users: UserRepository;
    dashboards: DashboardRepository;
    preferences: PreferencesRepository;
  };
  /** Called when a stored dashboard is no longer valid (it is replaced by the default). */
  onInvalidDashboard?: (userId: string) => void;
}

/** All routes under `/api`: wires repositories → services → controllers. */
export const createApiRouter = (deps: ApiDependencies): Router => {
  const router = Router();
  const auth = createAuthMiddlewares(deps.tokens);
  const { users, dashboards, preferences } = deps.repositories;

  const authController = createAuthController(
    createAuthService(users, deps.tokens),
    deps.cookie,
  );
  const dashboardController = createDashboardController(
    createDashboardService(dashboards, deps.onInvalidDashboard),
    createPreferencesService(preferences),
  );

  router.get("/health", getHealth);
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
