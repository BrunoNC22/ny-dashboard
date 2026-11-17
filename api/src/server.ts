import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createLogger } from "./lib/logger";

const env = loadEnv();
const logger = createLogger(env);
const app = createApp({ logger });

const server = app.listen(env.API_PORT, () => {
  logger.info(`API listening on http://localhost:${String(env.API_PORT)}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
