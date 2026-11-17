import { createApp } from "./app";
import { durationToMs, loadEnv } from "./config/env";
import { createLogger } from "./lib/logger";
import { createPrisma } from "./lib/prisma";
import { createTokenService } from "./lib/tokens";
import { createPrismaUserRepository } from "./models/userRepository";

const env = loadEnv();
const logger = createLogger(env);
const prisma = createPrisma(env.DATABASE_URL);

const app = createApp({
  logger,
  tokens: createTokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN),
  cookie: {
    secure: env.COOKIE_SECURE,
    maxAgeMs: durationToMs(env.JWT_EXPIRES_IN),
  },
  repositories: {
    users: createPrismaUserRepository(prisma),
  },
});

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
