import {
  createDefaultDashboard,
  DEFAULT_PREFERENCES,
  type Preferences,
} from "@ny-dashboard/shared";

import { Prisma } from "../generated/prisma/client";
import { conflict } from "../lib/errors";
import type { Db } from "../lib/prisma";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
}

/** Data access for users (the "M" of MVC; Prisma in production, in-memory in unit tests). */
export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /**
   * Creates the user with preferences and the default dashboard.
   * Throws a 409 AppError if the username is taken.
   */
  createWithDefaults(
    username: string,
    passwordHash: string,
    preferences?: Preferences,
  ): Promise<UserRecord>;
}

const select = { id: true, username: true, passwordHash: true } as const;

export const createPrismaUserRepository = (prisma: Db): UserRepository => ({
  findByUsername: (username) =>
    prisma.user.findUnique({ where: { username }, select }),
  findById: (id) => prisma.user.findUnique({ where: { id }, select }),
  async createWithDefaults(
    username,
    passwordHash,
    preferences = DEFAULT_PREFERENCES,
  ) {
    try {
      return await prisma.user.create({
        data: {
          username,
          passwordHash,
          preferences: { create: { ...preferences } },
          dashboard: { create: { state: createDefaultDashboard() } },
        },
        select,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw conflict("Este nome de usuário já está em uso");
      }
      throw error;
    }
  },
});
