import { credentialsSchema, DEFAULT_PREFERENCES } from "@ny-dashboard/shared";
import { describe, expect, it } from "vitest";

describe("api test environment", () => {
  it("resolves the shared workspace package from TypeScript sources", () => {
    expect(DEFAULT_PREFERENCES.theme).toBe("dark");
    expect(
      credentialsSchema.safeParse({ username: "demo", password: "demo1234" })
        .success,
    ).toBe(true);
  });

  it("runs on Node 24", () => {
    expect(Number(process.versions.node.split(".")[0])).toBeGreaterThanOrEqual(
      24,
    );
  });
});
