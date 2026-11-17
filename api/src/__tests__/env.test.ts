import { describe, expect, it } from "vitest";

import { loadEnv } from "../config/env";

const DATABASE_URL = "postgresql://ny:ny@localhost:5432/ny_dashboard";

describe("loadEnv", () => {
  it("applies defaults", () => {
    expect(loadEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: "development",
      API_PORT: 3000,
      LOG_LEVEL: "info",
      DATABASE_URL,
    });
  });

  it("requires a PostgreSQL DATABASE_URL", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: "mysql://x" })).toThrow(/postgresql/);
  });

  it("coerces and validates values", () => {
    expect(
      loadEnv({ DATABASE_URL, API_PORT: "8081", NODE_ENV: "production" }),
    ).toMatchObject({
      API_PORT: 8081,
      NODE_ENV: "production",
    });
    expect(() => loadEnv({ DATABASE_URL, API_PORT: "abc" })).toThrow(
      /Invalid environment: API_PORT/,
    );
    expect(() => loadEnv({ DATABASE_URL, LOG_LEVEL: "loud" })).toThrow(
      /LOG_LEVEL/,
    );
  });
});
