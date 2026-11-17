import { credentialsSchema } from "@ny-dashboard/shared";
import type { CookieOptions, RequestHandler } from "express";

import { unauthorized } from "../lib/errors";
import { requireSession, SESSION_COOKIE } from "../middlewares/auth";
import { validated } from "../middlewares/validate";
import type { AuthService } from "../services/authService";

export const authSchemas = {
  credentials: { body: credentialsSchema },
} as const;

export interface SessionCookieConfig {
  /** Only send the cookie over HTTPS. */
  secure: boolean;
  maxAgeMs: number;
}

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
}

export const createAuthController = (
  auth: AuthService,
  cookie: SessionCookieConfig,
): AuthController => {
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: cookie.secure,
    path: "/",
  };

  return {
    async register(_req, res) {
      const { body } = validated(res, authSchemas.credentials);
      const { user, token } = await auth.register(body);
      res.cookie(SESSION_COOKIE, token, {
        ...options,
        maxAge: cookie.maxAgeMs,
      });
      res.status(201).json({ user });
    },
    async login(_req, res) {
      const { body } = validated(res, authSchemas.credentials);
      const { user, token } = await auth.login(body);
      res.cookie(SESSION_COOKIE, token, {
        ...options,
        maxAge: cookie.maxAgeMs,
      });
      res.json({ user });
    },
    logout(_req, res) {
      res.clearCookie(SESSION_COOKIE, options);
      res.status(204).end();
    },
    async me(_req, res) {
      const user = await auth.getUser(requireSession(res).sub);
      if (!user) throw unauthorized("Sessão inválida");
      res.json({ user });
    },
  };
};
