import { Router } from "express";

import {
  type AuthController,
  authSchemas,
} from "../controllers/authController";
import type { AuthMiddlewares } from "../middlewares/auth";
import { validate } from "../middlewares/validate";

/** /api/auth/* */
export const createAuthRouter = (
  controller: AuthController,
  auth: AuthMiddlewares,
): Router => {
  const router = Router();
  router.post(
    "/register",
    validate(authSchemas.credentials),
    controller.register,
  );
  router.post("/login", validate(authSchemas.credentials), controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", auth.requireAuth, controller.me);
  return router;
};
