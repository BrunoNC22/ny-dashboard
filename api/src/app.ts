import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { apiRouter } from "./routes";

export interface AppDependencies {
  logger: Logger;
}

/**
 * Builds the Express app (MVC: routes → controllers → services → models; views serialize).
 * Exported separately from the server so tests can use it with supertest.
 */
export const createApp = ({ logger }: AppDependencies): Express => {
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

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
