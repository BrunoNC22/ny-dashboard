import type { Credentials, PublicUser } from "@ny-dashboard/shared";

import { AppError, conflict } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import type { TokenService } from "../lib/tokens";
import type { UserRecord, UserRepository } from "../models/userRepository";
import { toPublicUser } from "../views/userView";

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface AuthService {
  register(credentials: Credentials): Promise<AuthResult>;
  login(credentials: Credentials): Promise<AuthResult>;
  getUser(id: string): Promise<PublicUser | null>;
}

const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Usuário ou senha inválidos");

/**
 * When the user does not exist we still compare against a real hash, so a login takes about the
 * same time either way (does not reveal which usernames exist).
 */
const DUMMY_PASSWORD = "not-a-real-password";

export const createAuthService = (
  users: UserRepository,
  tokens: TokenService,
): AuthService => {
  const dummyHash = hashPassword(DUMMY_PASSWORD);
  const session = async (user: UserRecord): Promise<AuthResult> => ({
    user: toPublicUser(user),
    token: await tokens.sign({ sub: user.id, username: user.username }),
  });

  return {
    async register({ username, password }) {
      if (await users.findByUsername(username)) {
        throw conflict("Este nome de usuário já está em uso");
      }
      return session(
        await users.createWithDefaults(username, await hashPassword(password)),
      );
    },

    async login({ username, password }) {
      const user = await users.findByUsername(username);
      const valid = await verifyPassword(
        password,
        user?.passwordHash ?? (await dummyHash),
      );
      if (!user || !valid) throw invalidCredentials();
      return session(user);
    },

    async getUser(id) {
      const user = await users.findById(id);
      return user ? toPublicUser(user) : null;
    },
  };
};
