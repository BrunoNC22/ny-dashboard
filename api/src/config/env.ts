import { existsSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

/** Value shipped in .env.example; refused in production. */
export const EXAMPLE_JWT_SECRET = "change-me-in-production";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, "must be a postgresql:// URL"),
    JWT_SECRET: z.string().min(16, "must have at least 16 characters"),
    /** Session lifetime: <number><s|m|h|d>, e.g. "7d". */
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, "use <number><s|m|h|d>, e.g. 7d")
      .default("7d"),
    /** Send the session cookie only over HTTPS (keep false for http://localhost). */
    COOKIE_SECURE: booleanString.default(false),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== "production" || env.JWT_SECRET !== EXAMPLE_JWT_SECRET,
    {
      message: "set a real JWT_SECRET in production",
      path: ["JWT_SECRET"],
    },
  );
export type Env = z.infer<typeof envSchema>;

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** "7d" → milliseconds. */
export const durationToMs = (duration: string): number => {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid duration "${duration}"`);
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
};

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
