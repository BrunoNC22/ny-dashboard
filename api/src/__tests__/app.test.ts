import { apiErrorSchema } from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app";
import { silentLogger } from "./helpers";

const app = createApp({ logger: silentLogger });

describe("app", () => {
  it("GET /api/health returns ok", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      uptimeSeconds: expect.any(Number) as number,
    });
  });

  it("returns the standard error body for unknown routes", async () => {
    const response = await request(app).get("/api/nope");
    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(response.body).error).toEqual({
      code: "NOT_FOUND",
      message: "Rota não encontrada: GET /api/nope",
    });
  });

  it("rejects malformed JSON bodies with 400 INVALID_JSON", async () => {
    const response = await request(app)
      .post("/api/health")
      .set("content-type", "application/json")
      .send("{ invalid");
    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(response.body).error.code).toBe("INVALID_JSON");
  });

  it("does not expose the x-powered-by header", async () => {
    const response = await request(app).get("/api/health");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
