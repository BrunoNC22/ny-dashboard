import type { Palette, Theme } from "@ny-dashboard/shared";

/**
 * Design tokens — the single source of truth for every color in the app (CLAUDE.md §7).
 * `scripts/generate-tokens.ts` turns them into `tokens.generated.css` (CSS variables scoped by
 * `[data-theme][data-palette]` on <html>); Tailwind maps its colors to those variables, and the
 * chart/map themes (#31/#32) read the same values.
 *
 * Chart colors follow the data-viz method (validated, never eyeballed):
 * - the 8 categorical hues are the documented palette (light + dark steps);
 * - each UI palette is a different, validated ORDER of those hues (a "theme");
 * - status, sequential and diverging scales are fixed and never themed.
 */

export const THEME_NAMES = [
  "dark",
  "light",
] as const satisfies readonly Theme[];
export const PALETTE_NAMES = [
  "aurora",
  "sunset",
  "ocean",
  "neon",
  "forest",
  "mono",
] as const satisfies readonly Palette[];

// ── Categorical hues (documented palette: light step, dark step) ────────────────

export const HUES = {
  blue: { light: "#2a78d6", dark: "#3987e5" },
  orange: { light: "#eb6834", dark: "#d95926" },
  aqua: { light: "#1baf7a", dark: "#199e70" },
  yellow: { light: "#eda100", dark: "#c98500" },
  magenta: { light: "#e87ba4", dark: "#d55181" },
  green: { light: "#008300", dark: "#0ca30c" },
  violet: { light: "#6250d6", dark: "#9085e9" },
  red: { light: "#e34948", dark: "#e66767" },
} as const;
export type Hue = keyof typeof HUES;

/**
 * Slot order per palette. Each order was picked among the 160 of 40,320 orderings that pass
 * every gate of the data-viz validator in BOTH modes on the adjacent pairlist (CVD ΔE ≥ 8,
 * normal-vision ΔE ≥ 15, lightness band, chroma) against the app surfaces (#ffffff / #111827),
 * and whose first 3 slots also pass all-pairs (scatter, bubble and maps cap at 3 series).
 */
export const PALETTE_ORDERS: Readonly<Record<Palette, readonly Hue[]>> = {
  aurora: [
    "green",
    "violet",
    "magenta",
    "yellow",
    "aqua",
    "orange",
    "blue",
    "red",
  ],
  sunset: [
    "orange",
    "violet",
    "aqua",
    "yellow",
    "magenta",
    "green",
    "blue",
    "red",
  ],
  ocean: [
    "blue",
    "green",
    "magenta",
    "yellow",
    "aqua",
    "orange",
    "violet",
    "red",
  ],
  neon: [
    "magenta",
    "green",
    "blue",
    "orange",
    "aqua",
    "yellow",
    "violet",
    "red",
  ],
  forest: [
    "green",
    "blue",
    "magenta",
    "yellow",
    "aqua",
    "orange",
    "violet",
    "red",
  ],
  mono: [
    "blue",
    "orange",
    "aqua",
    "yellow",
    "magenta",
    "green",
    "violet",
    "red",
  ],
};

/** Series colors of a palette in a theme (slot 1..8). */
export const seriesColors = (palette: Palette, theme: Theme): string[] =>
  PALETTE_ORDERS[palette].map((hue) => HUES[hue][theme]);

// ── Surfaces and ink ───────────────────────────────────────────────────────────

export interface BaseTokens {
  /** Page background (under the gradient glows). */
  page: string;
  /** Card/chart surface (glass cards are this color at high opacity). */
  surface: string;
  /** Raised controls inside cards (inputs, hover). */
  surface2: string;
  border: string;
  borderStrong: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  ink2: string;
  /** Muted text (axes, captions). */
  muted: string;
  /** Chart gridline (hairline). */
  grid: string;
  /** Chart baseline/axis. */
  axis: string;
  /** Modal backdrop. */
  overlay: string;
  /** Glass card opacity (0–1) over the page glows. */
  glassAlpha: number;
}

export const BASE: Readonly<Record<Theme, BaseTokens>> = {
  dark: {
    page: "#070b14",
    surface: "#111827",
    surface2: "#1a2335",
    border: "rgba(255, 255, 255, 0.10)",
    borderStrong: "rgba(255, 255, 255, 0.18)",
    ink: "#f1f5f9",
    ink2: "#cbd5e1",
    muted: "#94a3b8",
    grid: "#1f2a3d",
    axis: "#334155",
    overlay: "rgba(2, 6, 15, 0.72)",
    glassAlpha: 0.78,
  },
  light: {
    page: "#eef1f8",
    surface: "#ffffff",
    surface2: "#f1f5f9",
    border: "rgba(15, 23, 42, 0.10)",
    borderStrong: "rgba(15, 23, 42, 0.18)",
    ink: "#0b1020",
    ink2: "#475569",
    muted: "#5b687c",
    grid: "#e5e7eb",
    axis: "#cbd5e1",
    overlay: "rgba(15, 23, 42, 0.45)",
    glassAlpha: 0.82,
  },
};

// ── UI accent per palette (buttons, focus, glows, page gradients) ──────────────

export interface AccentTokens {
  /** Gradient start (primary accent). */
  accent: string;
  /** Gradient end. */
  accent2: string;
  /** Text on top of the accent gradient (≥ 4.5:1 on both stops). */
  onAccent: string;
}

export const ACCENTS: Readonly<
  Record<Palette, Readonly<Record<Theme, AccentTokens>>>
> = {
  aurora: {
    dark: { accent: "#2dd4bf", accent2: "#a78bfa", onAccent: "#04121a" },
    light: { accent: "#0f766e", accent2: "#7c3aed", onAccent: "#ffffff" },
  },
  sunset: {
    dark: { accent: "#fb923c", accent2: "#f472b6", onAccent: "#1a0b05" },
    light: { accent: "#c2410c", accent2: "#be185d", onAccent: "#ffffff" },
  },
  ocean: {
    dark: { accent: "#38bdf8", accent2: "#34d399", onAccent: "#04121a" },
    light: { accent: "#0369a1", accent2: "#047857", onAccent: "#ffffff" },
  },
  neon: {
    dark: { accent: "#f472b6", accent2: "#4ade80", onAccent: "#14051a" },
    light: { accent: "#be185d", accent2: "#15803d", onAccent: "#ffffff" },
  },
  forest: {
    dark: { accent: "#4ade80", accent2: "#2dd4bf", onAccent: "#04140a" },
    light: { accent: "#15803d", accent2: "#0f766e", onAccent: "#ffffff" },
  },
  mono: {
    dark: { accent: "#e5e7eb", accent2: "#9ca3af", onAccent: "#0b1020" },
    light: { accent: "#111827", accent2: "#4b5563", onAccent: "#ffffff" },
  },
};

// ── Fixed scales (never themed) ────────────────────────────────────────────────

/** KPI/status colors: always shown with an icon + label, never color alone. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Label inside a status fill (documented: white, black on warning). */
export const ON_STATUS = {
  good: "#ffffff",
  warning: "#0b0b0b",
  serious: "#ffffff",
  critical: "#ffffff",
} as const;

/** Positive-delta text ("success text") per theme. */
export const SUCCESS_TEXT: Readonly<Record<Theme, string>> = {
  light: "#006300",
  dark: "#0ca30c",
};

/** Sequential magnitude ramp (blue, steps 100→700) for choropleths and heatmaps. */
export const SEQUENTIAL = [
  "#cde2fb",
  "#b7d3f6",
  "#9ec5f4",
  "#86b6ef",
  "#6da7ec",
  "#5598e7",
  "#3987e5",
  "#2a78d6",
  "#256abf",
  "#1c5cab",
  "#184f95",
  "#104281",
  "#0d366b",
] as const;

/**
 * Diverging scale for comparisons on the map: red ↔ green (owner's decision 45A, kept after
 * weighing the CVD trade-off) with a neutral gray midpoint. It is direction-aware: green =
 * improvement, red = worsening for the metric, and the value is always shown as ±% text
 * (legend "piora / melhora" + tooltip), so color is never the only channel.
 */
export const DIVERGING = {
  worse: "#d03b3b",
  better: "#0ca30c",
  neutral: { light: "#f0efec", dark: "#383835" },
} as const;

/**
 * Point shapes paired with the series colors in scatter/bubble charts: more than 3 color
 * categories are allowed there only with shape as a second channel (owner's decision).
 */
export const POINT_STYLES = [
  "circle",
  "rect",
  "triangle",
  "rectRot",
  "star",
  "crossRot",
  "rectRounded",
  "line",
] as const;

// ── CSS variables ──────────────────────────────────────────────────────────────

const toRgba = (hex: string, alpha: number): string => {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
};

/** Every CSS variable (without the leading "--nyd-") for a theme × palette. */
export const cssVariables = (
  theme: Theme,
  palette: Palette,
): Record<string, string> => {
  const base = BASE[theme];
  const accent = ACCENTS[palette][theme];
  const glow = theme === "dark" ? [0.22, 0.16] : [0.16, 0.12];
  return {
    page: base.page,
    surface: base.surface,
    "surface-glass": toRgba(base.surface, base.glassAlpha),
    "surface-2": base.surface2,
    border: base.border,
    "border-strong": base.borderStrong,
    ink: base.ink,
    "ink-2": base.ink2,
    muted: base.muted,
    grid: base.grid,
    axis: base.axis,
    overlay: base.overlay,
    accent: accent.accent,
    "accent-2": accent.accent2,
    "on-accent": accent.onAccent,
    "accent-glow": toRgba(accent.accent, 0.35),
    "page-glow-1": toRgba(accent.accent, glow[0] ?? 0.2),
    "page-glow-2": toRgba(accent.accent2, glow[1] ?? 0.15),
    ...Object.fromEntries(
      seriesColors(palette, theme).map((color, i) => [
        `series-${String(i + 1)}`,
        color,
      ]),
    ),
    good: STATUS.good,
    warning: STATUS.warning,
    serious: STATUS.serious,
    critical: STATUS.critical,
    "success-text": SUCCESS_TEXT[theme],
    "diverging-neutral": DIVERGING.neutral[theme],
  };
};

const block = (
  selector: string,
  vars: Record<string, string>,
  colorScheme: Theme,
) =>
  `${selector} {\n  color-scheme: ${colorScheme};\n${Object.entries(vars)
    .map(([name, value]) => `  --nyd-${name}: ${value};`)
    .join("\n")}\n}`;

/**
 * Full stylesheet: defaults on :root (dark + aurora, also the first paint), then one block per
 * theme × palette selected by `<html data-theme data-palette>`.
 */
export const tokensCss = (): string => {
  const header =
    "/* Generated by web/scripts/generate-tokens.ts from src/styles/tokens.ts — do not edit. */";
  const blocks = [block(":root", cssVariables("dark", "aurora"), "dark")];
  for (const theme of THEME_NAMES) {
    for (const palette of PALETTE_NAMES) {
      blocks.push(
        block(
          `:root[data-theme="${theme}"][data-palette="${palette}"]`,
          cssVariables(theme, palette),
          theme,
        ),
      );
    }
  }
  return `${header}\n\n${blocks.join("\n\n")}\n`;
};
