import { Router } from "express";

import {
  createAuthController,
  type SessionCookieConfig,
} from "../controllers/authController";
import { getHealth } from "../controllers/healthController";
import type { TokenService } from "../lib/tokens";
import { createAuthMiddlewares } from "../middlewares/auth";
import type { UserRepository } from "../models/userRepository";
import { createAuthService } from "../services/authService";
import { createAuthRouter } from "./auth";

/** Everything the routes need (real implementations in server.ts, fakes in unit tests). */
export interface ApiDependencies {
  tokens: TokenService;
  cookie: SessionCookieConfig;
  repositories: {
    users: UserRepository;
  };
}

/** All routes under `/api`: wires repositories → services → controllers. */
export const createApiRouter = (deps: ApiDependencies): Router => {
  const router = Router();
  const auth = createAuthMiddlewares(deps.tokens);
  const authService = createAuthService(deps.repositories.users, deps.tokens);

  router.get("/health", getHealth);
  router.use(
    "/auth",
    createAuthRouter(createAuthController(authService, deps.cookie), auth),
  );
  return router;
};
