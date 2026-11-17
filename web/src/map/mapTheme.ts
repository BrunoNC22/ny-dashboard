/**
 * Map styling (MapLibre basemap + deck.gl colors), derived from the same design tokens as the
 * charts (CLAUDE.md §7). Pure functions here; `useMapTheme` wires them to the active theme.
 */
import type { MetricDirection, Palette, Theme } from "@ny-dashboard/shared";
import type { StyleSpecification } from "maplibre-gl";

import {
  ACCENTS,
  BASE,
  DIVERGING,
  SEQUENTIAL,
  seriesColors,
} from "../styles/tokens";

export type Rgba = [number, number, number, number];

/** OpenFreeMap styles (free, no API key). */
export const BASEMAP_URL: Readonly<Record<Theme, string>> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

/** Data sources must be credited on the map and in the README (CLAUDE.md §5.1). */
export const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · ' +
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · ' +
  'Dados: <a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page" target="_blank" rel="noreferrer">NYC TLC</a>';

/** New York City as seen by the zone maps. */
export const NYC_VIEW = {
  longitude: -73.94,
  latitude: 40.7,
  zoom: 9.6,
  pitch: 0,
  bearing: 0,
};

// ── Color helpers ───────────────────────────────────────────────────────────────

export const hexToRgba = (hex: string, alpha = 255): Rgba => {
  const value = hex.replace("#", "");
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map((i) =>
    parseInt(value.slice(i, i + 2), 16),
  );
  return [r, g, b, alpha];
};

const toHex = ([r, g, b]: Rgba): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Linear mix in sRGB (t = 0 → a, t = 1 → b). */
export const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgba(a);
  const [br, bg, bb] = hexToRgba(b);
  return toHex([
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
    255,
  ]);
};

// ── Basemap tuning ──────────────────────────────────────────────────────────────

/**
 * Recolors the OpenFreeMap style to match the app: background in the page color, water tinted
 * with the palette accent, quieter roads/labels in ink tokens. Returns a new style object.
 */
export const tuneBasemapStyle = (
  style: StyleSpecification,
  theme: Theme,
  palette: Palette,
): StyleSpecification => {
  const base = BASE[theme];
  const accent = ACCENTS[palette][theme].accent;
  const water = mix(base.page, accent, theme === "dark" ? 0.18 : 0.12);
  const land =
    theme === "dark"
      ? mix(base.page, base.surface, 0.6)
      : mix(base.page, "#ffffff", 0.5);
  const layers = style.layers.map((layer) => {
    const id = layer.id.toLowerCase();
    const paint = { ...(layer.paint as Record<string, unknown> | undefined) };
    if (layer.type === "background") paint["background-color"] = land;
    else if (id.includes("water") && layer.type === "fill")
      paint["fill-color"] = water;
    else if (id.includes("water") && layer.type === "line")
      paint["line-color"] = water;
    else if (layer.type === "symbol") {
      paint["text-color"] = base.muted;
      paint["text-halo-color"] = land;
    }
    return { ...layer, paint };
  });
  return { ...style, layers };
};

// ── Sequential (magnitude) ──────────────────────────────────────────────────────

/**
 * Blue ramp from low to high. On dark the anchor flips: low values use the darkest steps so
 * they recede into the surface, high values the lightest.
 */
export const sequentialRamp = (theme: Theme): string[] => {
  const steps = [...SEQUENTIAL];
  return theme === "dark" ? steps.reverse() : steps;
};

/** Quantile thresholds (`classes − 1` of them) of the finite values. */
export const quantileBreaks = (
  values: readonly (number | null)[],
  classes: number,
): number[] => {
  const sorted = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return Array.from({ length: classes - 1 }, (_, i) => {
    const position = ((i + 1) / classes) * (sorted.length - 1);
    return sorted[Math.round(position)] ?? 0;
  });
};

/** Index of the class a value falls into, given ascending thresholds. */
export const classOf = (value: number, breaks: readonly number[]): number => {
  let index = 0;
  while (index < breaks.length && value > (breaks[index] ?? Infinity)) index++;
  return index;
};

/**
 * Choropleth colors by quantile classes (robust to the very skewed trips per zone: airports
 * dwarf most zones). Picks `classes` evenly spaced steps of the sequential ramp.
 */
export const quantileColorScale = (
  values: readonly (number | null)[],
  theme: Theme,
  classes = 7,
): {
  breaks: number[];
  colors: string[];
  colorOf: (value: number | null) => Rgba;
} => {
  const ramp = sequentialRamp(theme);
  const colors = Array.from(
    { length: classes },
    (_, i) =>
      ramp[Math.round((i * (ramp.length - 1)) / (classes - 1))] ??
      ramp[0] ??
      "#888888",
  );
  const breaks = quantileBreaks(values, classes);
  const empty = hexToRgba(BASE[theme].muted, 40);
  return {
    breaks,
    colors,
    colorOf: (value) =>
      value === null
        ? empty
        : hexToRgba(colors[classOf(value, breaks)] ?? "#888888", 210),
  };
};

// ── Diverging (comparison) ──────────────────────────────────────────────────────

/**
 * Red ↔ green by IMPROVEMENT (owner's decision 45A): green when the change is good for the
 * metric's direction, red when it is bad, gray near zero. Intensity grows with |Δ%| up to
 * `maxAbsPct`. Always paired with ±% text (legend "piora / melhora", tooltip).
 */
export const divergingColor = (
  deltaPct: number | null,
  direction: MetricDirection,
  theme: Theme,
  maxAbsPct = 30,
): Rgba => {
  const neutral = DIVERGING.neutral[theme];
  if (deltaPct === null || !Number.isFinite(deltaPct))
    return hexToRgba(neutral, 90);
  const improvement = direction === "higher_is_better" ? deltaPct : -deltaPct;
  const t = Math.min(1, Math.abs(improvement) / maxAbsPct);
  const pole = improvement >= 0 ? DIVERGING.better : DIVERGING.worse;
  return hexToRgba(mix(neutral, pole, 0.25 + 0.75 * t), 215);
};

/** Legend stops for the diverging scale (worse … neutral … better). */
export const divergingLegend = (theme: Theme): string[] => [
  DIVERGING.worse,
  mix(DIVERGING.neutral[theme], DIVERGING.worse, 0.5),
  DIVERGING.neutral[theme],
  mix(DIVERGING.neutral[theme], DIVERGING.better, 0.5),
  DIVERGING.better,
];

// ── Categories and accents ──────────────────────────────────────────────────────

/** deck.gl colors of the categorical slots (same fixed order as the charts). */
export const categoryColors = (
  palette: Palette,
  theme: Theme,
  alpha = 220,
): Rgba[] => seriesColors(palette, theme).map((hex) => hexToRgba(hex, alpha));

/** Arc colors: from the accent (origin) to accent-2 (destination). */
export const arcColors = (
  palette: Palette,
  theme: Theme,
): { source: Rgba; target: Rgba } => {
  const { accent, accent2 } = ACCENTS[palette][theme];
  return { source: hexToRgba(accent, 200), target: hexToRgba(accent2, 200) };
};

/** Zone outlines: hairline in the theme border tone. */
export const zoneLineColor = (theme: Theme): Rgba =>
  theme === "dark" ? [255, 255, 255, 40] : [15, 23, 42, 45];
