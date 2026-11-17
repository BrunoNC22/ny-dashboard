import type { Theme } from "@ny-dashboard/shared";

import { divergingLegend } from "../../map/mapTheme";

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
        className="glass pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] text-ink-2"
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
      className="glass pointer-events-none absolute top-2 left-2 z-10 flex flex-col gap-1 rounded-lg px-2 py-1.5 text-[10px] text-ink-2"
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
