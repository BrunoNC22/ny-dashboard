import { describe, expect, it } from "vitest";

import {
  credentialsSchema,
  DEFAULT_PREFERENCES,
  preferencesSchema,
  utf8ByteLength,
} from "../index";

describe("credentialsSchema", () => {
  it("accepts the seed user and normalizes the username", () => {
    expect(
      credentialsSchema.parse({ username: "  Demo ", password: "demo1234" }),
    ).toEqual({
      username: "demo",
      password: "demo1234",
    });
  });

  it("rejects short/invalid usernames", () => {
    expect(
      credentialsSchema.safeParse({ username: "ab", password: "demo1234" })
        .success,
    ).toBe(false);
    expect(
      credentialsSchema.safeParse({
        username: "nome com espaço",
        password: "demo1234",
      }).success,
    ).toBe(false);
  });

  it("enforces password length between 8 chars and 72 bytes", () => {
    expect(
      credentialsSchema.safeParse({ username: "demo", password: "1234567" })
        .success,
    ).toBe(false);
    expect(
      credentialsSchema.safeParse({
        username: "demo",
        password: "a".repeat(72),
      }).success,
    ).toBe(true);
    // 37 × "é" = 74 bytes in UTF-8 (only 37 characters)
    expect(
      credentialsSchema.safeParse({
        username: "demo",
        password: "é".repeat(37),
      }).success,
    ).toBe(false);
  });

  it("counts UTF-8 bytes", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("€")).toBe(3);
    expect(utf8ByteLength("🚕")).toBe(4);
  });
});

describe("preferencesSchema", () => {
  it("defaults to the dark theme with a valid palette", () => {
    expect(DEFAULT_PREFERENCES.theme).toBe("dark");
    expect(preferencesSchema.safeParse(DEFAULT_PREFERENCES).success).toBe(true);
  });

  it("rejects unknown palettes and themes", () => {
    expect(
      preferencesSchema.safeParse({ theme: "dark", palette: "rainbow" })
        .success,
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ theme: "sepia", palette: "aurora" })
        .success,
    ).toBe(false);
  });
});
