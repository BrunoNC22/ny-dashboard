import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createDependencies } from "./container";
import { createLogger } from "./lib/logger";
import { createPrisma } from "./lib/prisma";

const env = loadEnv();
const logger = createLogger(env);
const prisma = createPrisma(env.DATABASE_URL);
const app = createApp(createDependencies(prisma, env, logger));

const server = app.listen(env.API_PORT, () => {
  logger.info(`API listening on http://localhost:${String(env.API_PORT)}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
