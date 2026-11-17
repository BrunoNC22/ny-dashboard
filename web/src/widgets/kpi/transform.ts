import type {
  KpiRequest,
  KpiResponse,
  Status,
  WidgetConfigOf,
} from "@ny-dashboard/shared";

import type { EffectiveFilters } from "../resolveFilters";

export type KpiWidget = WidgetConfigOf<"kpi">;

export const toKpiRequest = (
  widget: KpiWidget,
  filters: EffectiveFilters,
): KpiRequest => {
  const { comparison, ...queryFilters } = filters;
  return {
    metric: widget.metric,
    filters: queryFilters,
    comparison,
    evaluation: widget.evaluation,
    sparkline: widget.sparkline,
  };
};

/** Status text shown next to its icon (never color alone, CLAUDE.md §7). */
export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  good: "Bom",
  warning: "Atenção",
  bad: "Ruim",
  neutral: "Sem avaliação",
};

/** Share of the target reached (%), or null without a target/value. */
export const targetProgress = (response: KpiResponse): number | null =>
  response.target === null || response.value === null || response.target === 0
    ? null
    : (response.value / response.target) * 100;

export interface SparkPoint {
  x: number;
  y: number | null;
}

export const sparkPoints = (response: KpiResponse): SparkPoint[] =>
  response.sparkline
    ? response.sparkline.t.map((_, i) => ({
        x: i,
        y: response.sparkline?.v[i] ?? null,
      }))
    : [];
