import { type Preferences, preferencesSchema } from "@ny-dashboard/shared";

/** Visitor theme/palette in localStorage (CLAUDE.md §6.5). Always wrapped in try/catch. */
export const LOCAL_PREFERENCES_KEY = "nyd:preferences:v1";

export const loadLocalPreferences = (): Preferences | null => {
  try {
    const raw = localStorage.getItem(LOCAL_PREFERENCES_KEY);
    if (!raw) return null;
    const parsed = preferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveLocalPreferences = (preferences: Preferences): void => {
  try {
    localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // ignore
  }
};

export const clearLocalPreferences = (): void => {
  try {
    localStorage.removeItem(LOCAL_PREFERENCES_KEY);
  } catch {
    // ignore
  }
};
