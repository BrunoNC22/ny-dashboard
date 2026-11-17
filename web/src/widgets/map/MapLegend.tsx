import type { Palette, Theme } from "@ny-dashboard/shared";
import { formatValue } from "@ny-dashboard/shared";

import { divergingLegend, type Rgba, sequentialRamp } from "../../map/mapTheme";
import { ACCENTS } from "../../styles/tokens";
import type { PointCategory, Shape } from "./sampleLayers";

export interface MapLegendProps {
  /** `size`: bubbles only (one color; the area encodes the value). */
  mode: "sequential" | "diverging" | "size";
  theme: Theme;
  /** Sequential class colors (low → high). */
  colors: readonly string[];
  /** Formatted lowest / highest quantile breaks (size: `max` is the largest value). */
  min: string;
  max: string;
  /** Metric name for the size legend. */
  metricLabel?: string;
}

/**
 * Glass legend in the map corner. Sequential: quantile classes (low → high values). Diverging:
 * worse ↔ better, never color alone (CLAUDE.md §7: the ±% is in the tooltip).
 */
export function MapLegend({
  mode,
  theme,
  colors,
  min,
  max,
  metricLabel = "",
}: MapLegendProps) {
  if (mode === "size") {
    return (
      <div
        className="glass flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] text-ink-2"
        aria-label="Legenda do mapa"
      >
        <span className="flex items-end gap-0.5" aria-hidden>
          <span className="size-1.5 rounded-full bg-series-1/70" />
          <span className="size-2.5 rounded-full bg-series-1/70" />
          <span className="size-3.5 rounded-full bg-series-1/70" />
        </span>
        área ∝ {metricLabel.toLowerCase()} · maior: {max}
      </div>
    );
  }
  const swatches = mode === "diverging" ? divergingLegend(theme) : colors;
  return (
    <div
      className="glass flex flex-col gap-1 rounded-lg px-2 py-1.5 text-[10px] text-ink-2"
      aria-label="Legenda do mapa"
    >
      <span className="flex items-center gap-1.5">
        <span>{mode === "diverging" ? "piora" : `≤ ${min}`}</span>
        <span className="flex">
          {swatches.map((color) => (
            <span
              key={color}
              className="h-2.5 w-3.5 first:rounded-l-sm last:rounded-r-sm"
              style={{ background: color }}
            />
          ))}
        </span>
        <span>{mode === "diverging" ? "melhora" : `> ${max}`}</span>
      </span>
      {mode === "sequential" && (
        <span className="text-muted">classes por quantil</span>
      )}
    </div>
  );
}

const SHAPE_PATHS: Readonly<Record<Shape, string>> = {
  circle: "M6 1a5 5 0 1 1 0 10A5 5 0 0 1 6 1z",
  square: "M1.5 1.5h9v9h-9z",
  triangle: "M6 1l5 9.5H1z",
  diamond: "M6 0.5L11.5 6 6 11.5 0.5 6z",
};

/** Points by category: color + shape (second channel) + count. */
export function PointsLegend({
  categories,
  colors,
}: {
  categories: readonly PointCategory[];
  colors: readonly Rgba[];
}) {
  return (
    <ul
      className="glass flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-[10px] text-ink-2"
      aria-label="Legenda dos pontos"
    >
      {[...categories]
        .sort((a, b) => a.slot - b.slot)
        .map((category) => {
          const [r = 0, g = 0, b = 0] = colors[category.slot] ?? [];
          return (
            <li key={category.key} className="flex items-center gap-1.5">
              <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
                <path
                  d={SHAPE_PATHS[category.shape]}
                  fill={`rgb(${String(r)} ${String(g)} ${String(b)})`}
                />
              </svg>
              {category.label}
              <span className="text-muted tabular-nums">
                {formatValue(category.count, "count", { compact: true })}
              </span>
            </li>
          );
        })}
    </ul>
  );
}

/** Heatmap / hexagons: density of the sampled pickups. */
export function DensityLegend({
  theme,
  total,
}: {
  theme: Theme;
  total: number;
}) {
  return (
    <div
      className="glass flex flex-col gap-1 rounded-lg px-2 py-1.5 text-[10px] text-ink-2"
      aria-label="Legenda de densidade"
    >
      <span className="flex items-center gap-1.5">
        <span>menos</span>
        <span
          className="h-2.5 w-20 rounded-sm"
          style={{
            background: `linear-gradient(90deg, ${sequentialRamp(theme).join(", ")})`,
          }}
          aria-hidden
        />
        <span>mais</span>
      </span>
      <span className="text-muted">
        embarques na amostra ({formatValue(total, "count", { compact: true })})
      </span>
    </div>
  );
}

/** Arcs: origin → destination colors, and how many routes are drawn. */
export function ArcsLegend({
  palette,
  theme,
  count,
}: {
  palette: Palette;
  theme: Theme;
  count: number;
}) {
  const { accent, accent2 } = ACCENTS[palette][theme];
  return (
    <div
      className="glass flex flex-col gap-1 rounded-lg px-2 py-1.5 text-[10px] text-ink-2"
      aria-label="Legenda das rotas"
    >
      <span className="flex items-center gap-1.5">
        <span>origem</span>
        <span
          className="h-1 w-16 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${accent}, ${accent2})`,
          }}
          aria-hidden
        />
        <span>destino</span>
      </span>
      <span className="text-muted">
        {String(count)} rotas mais frequentes · espessura ∝ valor
      </span>
    </div>
  );
}
