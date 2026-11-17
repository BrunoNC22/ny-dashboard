import { apiErrorSchema, publicUserSchema } from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createTokenService } from "../lib/tokens";
import { SESSION_COOKIE } from "../middlewares/auth";
import { createAuthService } from "../services/authService";
import {
  createMemoryUserRepository,
  createTestApp,
  TEST_JWT_SECRET,
} from "./helpers";

const userBody = z.object({ user: publicUserSchema });
const errorCode = (body: unknown) => apiErrorSchema.parse(body).error.code;

const sessionCookie = (headers: Record<string, unknown>): string => {
  const cookies = headers["set-cookie"];
  const list = Array.isArray(cookies) ? (cookies as string[]) : [];
  return list.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`)) ?? "";
};

describe("auth service", () => {
  const tokens = createTokenService(TEST_JWT_SECRET, "1h");

  it("registers with a hashed password and returns a session", async () => {
    const users = createMemoryUserRepository();
    const auth = createAuthService(users, tokens);
    const { user, token } = await auth.register({
      username: "ana",
      password: "segredo123",
    });
    expect(user).toEqual({ id: expect.any(String) as string, username: "ana" });
    expect(users.users[0]?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await tokens.verify(token)).toEqual({
      sub: user.id,
      username: "ana",
    });
  });

  it("rejects duplicated usernames with 409", async () => {
    const auth = createAuthService(createMemoryUserRepository(), tokens);
    await auth.register({ username: "ana", password: "segredo123" });
    await expect(
      auth.register({ username: "ana", password: "outra1234" }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("logs in only with the right password, without revealing which part was wrong", async () => {
    const auth = createAuthService(createMemoryUserRepository(), tokens);
    await auth.register({ username: "ana", password: "segredo123" });
    await expect(
      auth.login({ username: "ana", password: "segredo123" }),
    ).resolves.toMatchObject({
      user: { username: "ana" },
    });
    for (const credentials of [
      { username: "ana", password: "errada123" },
      { username: "ninguem", password: "segredo123" },
    ]) {
      await expect(auth.login(credentials)).rejects.toMatchObject({
        status: 401,
        code: "INVALID_CREDENTIALS",
      });
    }
  });

  it("rejects tampered, foreign and expired tokens", async () => {
    const token = await tokens.sign({ sub: "u1", username: "ana" });
    expect(await tokens.verify(`${token}x`)).toBeNull();
    const other = createTokenService("another-secret-with-length", "1h");
    expect(
      await tokens.verify(await other.sign({ sub: "u1", username: "ana" })),
    ).toBeNull();
    const expired = createTokenService(TEST_JWT_SECRET, "0s");
    const old = await expired.sign({ sub: "u1", username: "ana" });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await tokens.verify(old)).toBeNull();
  });
});

describe("auth routes", () => {
  it("register → me → logout → me", async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);

    const registered = await agent
      .post("/api/auth/register")
      .send({ username: "  Ana ", password: "segredo123" });
    expect(registered.status).toBe(201);
    expect(userBody.parse(registered.body).user.username).toBe("ana"); // normalized

    const cookie = sessionCookie(registered.headers);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(userBody.parse(me.body).user.username).toBe("ana");

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(204);
    expect(sessionCookie(logout.headers)).toMatch(/Expires=Thu, 01 Jan 1970/);

    const after = await agent.get("/api/auth/me");
    expect(after.status).toBe(401);
    expect(errorCode(after.body)).toBe("UNAUTHORIZED");
  });

  it("logs in an existing user", async () => {
    const { app } = createTestApp();
    await request(app)
      .post("/api/auth/register")
      .send({ username: "bia", password: "senha1234" });
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "bia", password: "senha1234" });
    expect(response.status).toBe(200);
    expect(sessionCookie(response.headers)).not.toBe("");

    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ username: "bia", password: "senha0000" });
    expect(wrong.status).toBe(401);
    expect(errorCode(wrong.body)).toBe("INVALID_CREDENTIALS");
  });

  it("validates credentials with the shared schema", async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "a", password: "123" });
    expect(response.status).toBe(400);
    expect(errorCode(response.body)).toBe("VALIDATION_ERROR");
  });

  it("returns 409 for a taken username", async () => {
    const { app } = createTestApp();
    const body = { username: "carla", password: "senha1234" };
    await request(app).post("/api/auth/register").send(body);
    const response = await request(app).post("/api/auth/register").send(body);
    expect(response.status).toBe(409);
  });

  it("rejects requests with an invalid session cookie", async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=not-a-jwt`);
    expect(response.status).toBe(401);
  });

  it("marks the cookie as Secure when configured", async () => {
    const { app } = createTestApp({ cookie: { secure: true, maxAgeMs: 1000 } });
    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "dani", password: "senha1234" });
    expect(sessionCookie(response.headers)).toMatch(/Secure/);
  });
});
