import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "etl/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.int.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "etl/**/*.ts"],
      exclude: [
        "**/__tests__/**",
        "**/__integration__/**",
        "**/*.test.ts",
        "etl/types/**",
      ],
      reporter: ["text", "html", "lcov"],
    },
  },
});
