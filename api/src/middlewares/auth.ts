import type { RequestHandler, Response } from "express";

import { unauthorized } from "../lib/errors";
import type { SessionClaims, TokenService } from "../lib/tokens";

/** Name of the session cookie (httpOnly JWT; CLAUDE.md §6.6). */
export const SESSION_COOKIE = "nyd_session";

export interface AuthMiddlewares {
  /** Rejects the request with 401 unless there is a valid session. */
  requireAuth: RequestHandler;
  /** Attaches the session if there is one, never rejects. */
  optionalAuth: RequestHandler;
}

const readSession = async (
  tokens: TokenService,
  cookies: unknown,
): Promise<SessionClaims | null> => {
  const token = (cookies as Record<string, unknown> | undefined)?.[
    SESSION_COOKIE
  ];
  return typeof token === "string" ? tokens.verify(token) : null;
};

export const createAuthMiddlewares = (
  tokens: TokenService,
): AuthMiddlewares => ({
  async requireAuth(req, res, next) {
    const session = await readSession(tokens, req.cookies);
    if (!session) throw unauthorized();
    res.locals.session = session;
    next();
  },
  async optionalAuth(req, res, next) {
    res.locals.session = await readSession(tokens, req.cookies);
    next();
  },
});

/** Session of the current request (set by the auth middlewares). */
export const currentSession = (res: Response): SessionClaims | null =>
  (res.locals.session as SessionClaims | null | undefined) ?? null;

/** Session of a route protected by `requireAuth`. */
export const requireSession = (res: Response): SessionClaims => {
  const session = currentSession(res);
  if (!session) throw unauthorized();
  return session;
};
