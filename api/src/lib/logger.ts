import { type DestinationStream, type Logger, pino } from "pino";

import type { Env } from "../config/env";

/**
 * Session secrets never reach the logs: the request cookie and the response `set-cookie` (the
 * JWT) are redacted from the pino-http request logs.
 */
export const REDACTED_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
];

/** JSON logs in production; pretty, colored logs in development. */
export const createLogger = (
  env: Pick<Env, "NODE_ENV" | "LOG_LEVEL">,
  /** Custom destination (tests); stdout otherwise. */
  destination?: DestinationStream,
): Logger =>
  pino(
    {
      level: env.LOG_LEVEL,
      redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
      ...(env.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                translateTime: "SYS:HH:MM:ss",
                ignore: "pid,hostname",
              },
            },
          }
        : {}),
    },
    destination,
  );
