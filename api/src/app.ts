import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { type ApiDependencies, createApiRouter } from "./routes";

export interface AppDependencies extends ApiDependencies {
  logger: Logger;
}

/**
 * Builds the Express app (MVC: routes → controllers → services → models; views serialize).
 * Exported separately from the server so tests can use it with supertest.
 */
export const createApp = ({ logger, ...deps }: AppDependencies): Express => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind nginx in production

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api", createApiRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
