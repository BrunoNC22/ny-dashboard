import { describe, expect, it } from "vitest";

import { loadEnv } from "../config/env";

describe("loadEnv", () => {
  it("applies defaults", () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: "development",
      API_PORT: 3000,
      LOG_LEVEL: "info",
    });
  });

  it("coerces and validates values", () => {
    expect(loadEnv({ API_PORT: "8081", NODE_ENV: "production" })).toMatchObject(
      {
        API_PORT: 8081,
        NODE_ENV: "production",
      },
    );
    expect(() => loadEnv({ API_PORT: "abc" })).toThrow(
      /Invalid environment: API_PORT/,
    );
    expect(() => loadEnv({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
