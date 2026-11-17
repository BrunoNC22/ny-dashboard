import {
  createDefaultDashboard,
  DEFAULT_PREFERENCES,
} from "@ny-dashboard/shared";

import { hashPassword } from "../lib/password";
import type { Db } from "../lib/prisma";

/** Demo account (CLAUDE.md §6.6). */
export const DEMO_USER = { username: "demo", password: "demo1234" } as const;

/**
 * Creates the demo user with default preferences and the default dashboard if it does not exist.
 * An existing demo user (possibly customized) is left untouched. Returns true if created.
 */
export const ensureDemoUser = async (prisma: Db): Promise<boolean> => {
  const existing = await prisma.user.findUnique({
    where: { username: DEMO_USER.username },
  });
  if (existing) return false;
  await prisma.user.create({
    data: {
      username: DEMO_USER.username,
      passwordHash: await hashPassword(DEMO_USER.password),
      preferences: { create: { ...DEFAULT_PREFERENCES } },
      dashboard: { create: { state: createDefaultDashboard() } },
    },
  });
  return true;
};
