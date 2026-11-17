import { jwtVerify, SignJWT } from "jose";

export interface SessionClaims {
  /** User id. */
  sub: string;
  username: string;
}

export interface TokenService {
  sign(claims: SessionClaims): Promise<string>;
  /** Returns the claims, or null if the token is invalid or expired. */
  verify(token: string): Promise<SessionClaims | null>;
}

const ISSUER = "ny-dashboard";

/** HS256 JWTs (CLAUDE.md §6.6). `expiresIn` uses jose's format, e.g. "7d". */
export const createTokenService = (
  secret: string,
  expiresIn: string,
): TokenService => {
  const key = new TextEncoder().encode(secret);
  return {
    sign: ({ sub, username }) =>
      new SignJWT({ username })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(sub)
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key),
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: ISSUER,
          algorithms: ["HS256"],
        });
        if (
          typeof payload.sub !== "string" ||
          typeof payload.username !== "string"
        )
          return null;
        return { sub: payload.sub, username: payload.username };
      } catch {
        return null;
      }
    },
  };
};
