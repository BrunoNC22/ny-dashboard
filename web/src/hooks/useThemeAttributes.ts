import {
  DEFAULT_PREFERENCES,
  type Palette,
  PALETTES,
  type Theme,
  THEMES,
} from "@ny-dashboard/shared";
import { useSyncExternalStore } from "react";

export interface ThemeAttributes {
  theme: Theme;
  palette: Palette;
}

const read = (): string => {
  const { theme, palette } = document.documentElement.dataset;
  return `${theme ?? ""}|${palette ?? ""}`;
};

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-palette"],
  });
  return () => {
    observer.disconnect();
  };
};

/** The active theme/palette, read from <html data-theme data-palette> (kept in sync). */
export const useThemeAttributes = (): ThemeAttributes => {
  const snapshot = useSyncExternalStore(subscribe, read, read);
  const [theme, palette] = snapshot.split("|");
  return {
    theme: (THEMES as readonly string[]).includes(theme ?? "")
      ? (theme as Theme)
      : DEFAULT_PREFERENCES.theme,
    palette: (PALETTES as readonly string[]).includes(palette ?? "")
      ? (palette as Palette)
      : DEFAULT_PREFERENCES.palette,
  };
};
