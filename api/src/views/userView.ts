import type { PublicUser } from "@ny-dashboard/shared";

/** Public representation of a user (never exposes the password hash). */
export const toPublicUser = ({
  id,
  username,
}: {
  id: string;
  username: string;
}): PublicUser => ({
  id,
  username,
});
