import type { RequestHandler, Response } from "express";
import type { z } from "zod";

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

type Validated<S extends Schemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

/**
 * Validates body/query/params with zod and stores the parsed values in `res.locals.validated`
 * (Express 5 makes `req.query` read-only). Failures reach the error handler as a 400.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    const validated: Record<string, unknown> = {};
    for (const key of ["body", "query", "params"] as const) {
      const schema = schemas[key];
      if (schema) validated[key] = schema.parse(req[key]);
    }
    res.locals.validated = validated;
    next();
  };

/** Typed access to the values validated by `validate(schemas)`. */
export const validated = <S extends Schemas>(
  res: Response,
  _schemas: S,
): Validated<S> => res.locals.validated as Validated<S>;
