import { Router } from "express";

import { getHealth } from "../controllers/healthController";

/** All routes under `/api`. */
export const apiRouter = Router();

apiRouter.get("/health", getHealth);
