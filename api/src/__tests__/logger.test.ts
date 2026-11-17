import { Writable } from "node:stream";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { createLogger } from "../lib/logger";
import { createTestApp } from "./helpers";

describe("request logs", () => {
  it("never contain the session cookie or token", async () => {
    let output = "";
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const logger = createLogger({ NODE_ENV: "test", LOG_LEVEL: "info" }, sink);
    const { app } = createTestApp({ logger });

    const registered = await request(app)
      .post("/api/auth/register")
      .send({ username: "ana", password: "segredo123" });
    const cookie = registered.headers["set-cookie"]?.[0] ?? "";
    const token = /nyd_session=([^;]+)/.exec(cookie)?.[1] ?? "";
    expect(token).not.toBe("");
    await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(output).toContain("[redacted]");
    expect(output).not.toContain(token);
  });
});
