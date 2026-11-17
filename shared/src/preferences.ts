import { z } from "zod";

export const THEMES = ["light", "dark"] as const;
export const themeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof themeSchema>;

/** Names are provisional (CLAUDE.md §7). */
export const PALETTES = [
  "aurora",
  "sunset",
  "ocean",
  "neon",
  "forest",
  "mono",
] as const;
export const paletteSchema = z.enum(PALETTES);
export type Palette = z.infer<typeof paletteSchema>;

export const preferencesSchema = z.object({
  theme: themeSchema,
  palette: paletteSchema,
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  theme: "dark",
  palette: "aurora",
};
