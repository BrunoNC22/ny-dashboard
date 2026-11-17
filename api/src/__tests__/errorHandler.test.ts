import { apiErrorSchema } from "@ny-dashboard/shared";
import express from "express";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, conflict, notFound } from "../lib/errors";
import { errorHandler, toApiError } from "../middlewares/errorHandler";
import { validate, validated } from "../middlewares/validate";
import { silentLogger } from "./helpers";

describe("toApiError", () => {
  it("serializes AppError with its status, code and details", () => {
    expect(
      toApiError(new AppError(422, "UNPROCESSABLE", "Nope", { field: "x" })),
    ).toEqual({
      status: 422,
      body: {
        error: {
          code: "UNPROCESSABLE",
          message: "Nope",
          details: { field: "x" },
        },
      },
    });
    expect(toApiError(notFound()).status).toBe(404);
    expect(toApiError(conflict("Usuário já existe")).body.error).toEqual({
      code: "CONFLICT",
      message: "Usuário já existe",
    });
  });

  it("maps zod errors to 400 VALIDATION_ERROR with paths", () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 1 });
    if (result.success) throw new Error("expected a zod error");
    const { status, body } = toApiError(result.error);
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([
      { path: "name", message: expect.any(String) as string },
    ]);
  });

  it("hides unexpected errors behind a generic 500", () => {
    expect(toApiError(new Error("db password is hunter2"))).toEqual({
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Erro interno" } },
    });
    expect(toApiError("boom").status).toBe(500);
  });

  it("always produces bodies that match the shared schema", () => {
    for (const error of [
      new AppError(400, "X", "y"),
      new Error("z"),
      { type: "entity.too.large", status: 413 },
    ]) {
      expect(apiErrorSchema.safeParse(toApiError(error).body).success).toBe(
        true,
      );
    }
  });
});

describe("errorHandler and validate middleware", () => {
  const schemas = {
    body: z.object({ n: z.number().int() }),
    query: z.object({ q: z.string().default("x") }),
  };
  const app = express();
  app.use(pinoHttp({ logger: silentLogger }));
  app.use(express.json());
  app.post("/echo", validate(schemas), (_req, res) => {
    const { body, query } = validated(res, schemas);
    res.json({ n: body.n * 2, q: query.q });
  });
  app.get("/fail", () => {
    throw new AppError(418, "TEAPOT", "Sou um bule");
  });
  app.get("/async-fail", async () => {
    await Promise.resolve();
    throw new Error("async boom");
  });
  app.use(errorHandler);

  it("passes parsed values (with defaults) to the controller", async () => {
    const response = await request(app).post("/echo").send({ n: 21 });
    expect(response.body).toEqual({ n: 42, q: "x" });
  });

  it("responds 400 with details when validation fails", async () => {
    const response = await request(app).post("/echo").send({ n: 1.5 });
    expect(response.status).toBe(400);
    const { error } = apiErrorSchema.parse(response.body);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { path: "n", message: expect.any(String) as string },
    ]);
  });

  it("handles sync and async errors (Express 5 forwards rejected promises)", async () => {
    expect((await request(app).get("/fail")).body).toEqual({
      error: { code: "TEAPOT", message: "Sou um bule" },
    });
    const asyncResponse = await request(app).get("/async-fail");
    expect(asyncResponse.status).toBe(500);
    expect(apiErrorSchema.parse(asyncResponse.body).error.code).toBe(
      "INTERNAL_ERROR",
    );
  });
});
