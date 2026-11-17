import {
  DEFAULT_PREFERENCES,
  type Palette,
  type Preferences,
  preferencesSchema,
  type Theme,
} from "@ny-dashboard/shared";
import { create } from "zustand";

/**
 * Last applied appearance, read by the inline script in index.html before the first paint
 * (no flash of the wrong theme). Separate from the visitor's `nyd:preferences:v1`, which also
 * signals "local customizations worth importing" (#34).
 */
export const APPEARANCE_KEY = "nyd:appearance:v1";

/** Applies the preferences to <html data-theme data-palette>; charts and maps follow it. */
export const applyAppearance = ({ theme, palette }: Preferences): void => {
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  if (root.dataset.palette !== palette) root.dataset.palette = palette;
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme, palette }));
  } catch {
    // ignore
  }
};

/** Preferences currently on <html> (set by the inline script), or the defaults. */
export const readAppearance = (): Preferences => {
  const { theme, palette } = document.documentElement.dataset;
  const parsed = preferencesSchema.safeParse({ theme, palette });
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
};

export interface PreferencesStore {
  preferences: Preferences;
  /** Increments on every user change (save trigger). */
  revision: number;
  /** User changes not yet saved to the server. */
  dirty: boolean;
  /** Dev `?theme=&palette=` override: sync never replaces it. */
  locked: boolean;
  setTheme: (theme: Theme) => void;
  setPalette: (palette: Palette) => void;
  toggleTheme: () => void;
  /** Replaces the preferences without counting as a user change (server / storage). */
  hydrate: (preferences: Preferences) => void;
  markSaved: (revision: number) => void;
  lock: (preferences: Preferences) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => {
  const change = (patch: Partial<Preferences>) => {
    const { preferences, revision } = get();
    const next = { ...preferences, ...patch };
    applyAppearance(next);
    set({ preferences: next, revision: revision + 1, dirty: true });
  };

  return {
    preferences: readAppearance(),
    revision: 0,
    dirty: false,
    locked: false,
    setTheme: (theme) => {
      change({ theme });
    },
    setPalette: (palette) => {
      change({ palette });
    },
    toggleTheme: () => {
      change({ theme: get().preferences.theme === "dark" ? "light" : "dark" });
    },
    hydrate: (preferences) => {
      if (get().locked) return;
      applyAppearance(preferences);
      set({ preferences, dirty: false });
    },
    markSaved: (revision) => {
      if (get().revision === revision) set({ dirty: false });
    },
    lock: (preferences) => {
      applyAppearance(preferences);
      set({ preferences, locked: true });
    },
  };
});
