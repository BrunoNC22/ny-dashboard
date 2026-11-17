import { type Logger, pino } from "pino";

import type { Env } from "../config/env";

/** JSON logs in production; pretty, colored logs in development. */
export const createLogger = (
  env: Pick<Env, "NODE_ENV" | "LOG_LEVEL">,
): Logger =>
  pino({
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
          },
        }
      : {}),
  });
