import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the docker compose stack (CLAUDE.md §10):
 *   docker compose up -d --build   →   pnpm e2e
 * E2E_BASE_URL points elsewhere (default http://localhost:8080); PW_CHROMIUM_PATH uses a
 * system Chromium instead of Playwright's download.
 */
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Tests create their own users, so they can run in parallel.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    locale: "pt-BR",
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1400, height: 1000 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
