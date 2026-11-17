import { describe, expect, it } from "vitest";

import { durationToMs, EXAMPLE_JWT_SECRET, loadEnv } from "../config/env";

const base = {
  DATABASE_URL: "postgresql://ny:ny@localhost:5432/ny_dashboard",
  JWT_SECRET: "a-test-secret-with-length",
};

describe("loadEnv", () => {
  it("applies defaults", () => {
    expect(loadEnv(base)).toEqual({
      ...base,
      NODE_ENV: "development",
      API_PORT: 3000,
      LOG_LEVEL: "info",
      JWT_EXPIRES_IN: "7d",
      COOKIE_SECURE: false,
    });
  });

  it("requires a PostgreSQL DATABASE_URL and a long JWT_SECRET", () => {
    expect(() => loadEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => loadEnv({ ...base, DATABASE_URL: "mysql://x" })).toThrow(
      /postgresql/,
    );
    expect(() => loadEnv({ ...base, JWT_SECRET: "short" })).toThrow(
      /JWT_SECRET/,
    );
  });

  it("refuses the example JWT secret in production only", () => {
    expect(
      loadEnv({ ...base, JWT_SECRET: EXAMPLE_JWT_SECRET }).JWT_SECRET,
    ).toBe(EXAMPLE_JWT_SECRET);
    expect(() =>
      loadEnv({
        ...base,
        JWT_SECRET: EXAMPLE_JWT_SECRET,
        NODE_ENV: "production",
      }),
    ).toThrow(/real JWT_SECRET/);
  });

  it("coerces and validates values", () => {
    expect(
      loadEnv({
        ...base,
        API_PORT: "8081",
        NODE_ENV: "production",
        COOKIE_SECURE: "true",
      }),
    ).toMatchObject({
      API_PORT: 8081,
      NODE_ENV: "production",
      COOKIE_SECURE: true,
    });
    expect(() => loadEnv({ ...base, API_PORT: "abc" })).toThrow(
      /Invalid environment: API_PORT/,
    );
    expect(() => loadEnv({ ...base, LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
    expect(() => loadEnv({ ...base, JWT_EXPIRES_IN: "1 week" })).toThrow(
      /JWT_EXPIRES_IN/,
    );
  });
});

describe("durationToMs", () => {
  it("converts s/m/h/d", () => {
    expect(durationToMs("30s")).toBe(30_000);
    expect(durationToMs("15m")).toBe(900_000);
    expect(durationToMs("2h")).toBe(7_200_000);
    expect(durationToMs("7d")).toBe(604_800_000);
    expect(() => durationToMs("1w")).toThrow(/Invalid duration/);
  });
});
