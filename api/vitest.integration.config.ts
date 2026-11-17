import { defineConfig } from "vitest/config";

/** Integration tests: real PostgreSQL (see src/__integration__/globalSetup.ts). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/__integration__/globalSetup.ts"],
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
