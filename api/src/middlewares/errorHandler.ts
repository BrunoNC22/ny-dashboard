import type { ApiError } from "@ny-dashboard/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../lib/errors";

/** Body-parser errors carry `type` and `status`. */
const isBodyParserError = (
  error: unknown,
): error is { type: string; status: number } =>
  typeof error === "object" &&
  error !== null &&
  "type" in error &&
  "status" in error;

/** Maps any thrown error to the standard API error body (shared `apiErrorSchema`). */
export const toApiError = (
  error: unknown,
): { status: number; body: ApiError } => {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
    };
  }
  if (isBodyParserError(error) && error.type === "entity.parse.failed") {
    return {
      status: 400,
      body: { error: { code: "INVALID_JSON", message: "JSON inválido" } },
    };
  }
  if (isBodyParserError(error) && error.type === "entity.too.large") {
    return {
      status: 413,
      body: {
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Corpo da requisição muito grande",
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Erro interno" } },
  };
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const { status, body } = toApiError(error);
  if (status >= 500) req.log.error({ err: error }, "unhandled error");
  res.status(status).json(body);
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Rota não encontrada: ${req.method} ${req.path}`,
    },
  } satisfies ApiError);
};
