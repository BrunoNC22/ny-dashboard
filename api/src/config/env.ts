import { existsSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});
export type Env = z.infer<typeof envSchema>;

/**
 * Validates the environment. Outside production, the root `.env` (if any) is loaded first;
 * variables already set in the process take precedence.
 */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  if (source === process.env && process.env.NODE_ENV !== "production") {
    const dotenv = join(import.meta.dirname, "..", "..", "..", ".env");
    if (existsSync(dotenv)) process.loadEnvFile(dotenv);
  }
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return parsed.data;
};
