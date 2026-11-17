import {
  type DashboardResponse,
  type DashboardState,
  type Preferences,
  type PreferencesResponse,
  preferencesSchema,
} from "@ny-dashboard/shared";

export const toDashboardResponse = ({
  state,
  updatedAt,
}: {
  state: unknown;
  updatedAt: Date;
}): DashboardResponse => ({
  state: state as DashboardState,
  updatedAt: updatedAt.toISOString(),
});

export const toPreferencesResponse = ({
  theme,
  palette,
  updatedAt,
}: {
  theme: string;
  palette: string;
  updatedAt: Date;
}): PreferencesResponse => ({
  preferences: preferencesSchema.parse({ theme, palette } satisfies Record<
    keyof Preferences,
    string
  >),
  updatedAt: updatedAt.toISOString(),
});
