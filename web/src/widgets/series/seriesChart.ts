import {
  formatDeltaPct,
  formatIsoDate,
  formatValue,
  type Granularity,
  type MetricDirection,
  type Unit,
} from "@ny-dashboard/shared";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";

import {
  areaFill,
  type ChartTheme,
  comparisonStyle,
  largeDataOptions,
  progressiveLineAnimation,
  projectionStyle,
  seriesColor,
  stackedBarStyle,
  timeScale,
} from "../../charts/chartTheme";
import type { SeriesDataset, SeriesPoint } from "./transform";

export type SeriesChartType = "line" | "area" | "bar" | "stacked_bar";
type Mixed = "line" | "bar";

export interface SeriesChartOptions {
  type: SeriesChartType;
  theme: ChartTheme;
  unit: Unit;
  granularity: Granularity;
  direction: MetricDirection;
  /** x → % deviation from the projection (highlighted points). */
  deviations?: ReadonlyMap<number, number>;
  /** Visible x range: the current period (a longer compared month must not stretch it). */
  xRange?: { min: number; max: number };
}

export interface SeriesChartConfig {
  type: Mixed;
  data: ChartData<Mixed, SeriesPoint[]>;
  options: ChartOptions<Mixed>;
}

const ORDER = { current: 0, comparison: 1, projection: 2 } as const;

/** Chart.js config for a time series widget; every visual detail comes from chartTheme. */
export const seriesChartConfig = (
  datasets: readonly SeriesDataset[],
  {
    type,
    theme,
    unit,
    granularity,
    direction,
    deviations,
    xRange,
  }: SeriesChartOptions,
): SeriesChartConfig => {
  const bars = type === "bar" || type === "stacked_bar";
  const stacked = type === "stacked_bar";
  const points = Math.max(0, ...datasets.map((d) => d.points.length));
  const large = largeDataOptions(points);
  const good = (pct: number) =>
    direction === "higher_is_better" ? pct > 0 : pct < 0;

  const chartDatasets = datasets.map((dataset) => {
    const color = seriesColor(theme, dataset.colorIndex);
    const common = {
      label: dataset.label,
      data: dataset.points,
      order: ORDER[dataset.role],
    };
    if (dataset.role === "comparison") {
      return {
        ...common,
        type: "line" as const,
        ...comparisonStyle(color),
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
        stack: "comparison",
        tension: 0.25,
      };
    }
    if (dataset.role === "projection") {
      return {
        ...common,
        type: "line" as const,
        ...projectionStyle(theme),
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
        stack: "projection",
        tension: 0.25,
      };
    }
    if (bars) {
      return {
        ...common,
        type: "bar" as const,
        ...(stacked
          ? stackedBarStyle(theme, color)
          : { backgroundColor: color, borderRadius: 4 }),
        stack: "current",
        maxBarThickness: 28,
      };
    }
    const highlight = (x: number) => deviations?.get(x);
    return {
      ...common,
      type: "line" as const,
      borderColor: color,
      backgroundColor: type === "area" ? areaFill(color) : color,
      fill: type === "area" ? "origin" : false,
      borderWidth: 2,
      tension: 0.25,
      pointRadius: (ctx: { raw: unknown }) =>
        highlight((ctx.raw as SeriesPoint | undefined)?.x ?? NaN) === undefined
          ? 0
          : 4,
      pointBackgroundColor: (ctx: { raw: unknown }) => {
        const pct = highlight((ctx.raw as SeriesPoint | undefined)?.x ?? NaN);
        if (pct === undefined) return color;
        return good(pct) ? theme.status.good : theme.status.critical;
      },
      pointBorderColor: theme.surface,
      pointHoverRadius: 4,
    };
  });

  const label = (item: TooltipItem<Mixed>): string => {
    const raw = item.raw as SeriesPoint;
    const value = formatValue(raw.y, unit);
    const role = datasets[item.datasetIndex]?.role;
    if (role === "comparison") {
      return `${item.dataset.label ?? ""}: ${value} (${formatIsoDate(raw.t.slice(0, 10))})`;
    }
    const deviation = role === "current" ? deviations?.get(raw.x) : undefined;
    return `${item.dataset.label ?? ""}: ${value}${
      deviation === undefined
        ? ""
        : ` · ${formatDeltaPct(deviation)} vs. projeção`
    }`;
  };

  const options: ChartOptions<Mixed> = {
    responsive: true,
    maintainAspectRatio: false,
    ...large,
    // Lines and areas are drawn left → right (big series keep animation off: `large`).
    ...(!bars && !("animation" in large)
      ? { animations: progressiveLineAnimation(points) }
      : {}),
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        ...timeScale(granularity, { auto: true }),
        offset: bars,
        stacked,
        ...(xRange && !bars ? xRange : {}),
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        stacked,
        ticks: {
          maxTicksLimit: 6,
          callback: (value) =>
            formatValue(Number(value), unit, { compact: true }),
        },
      },
    },
    plugins: {
      ...("plugins" in large ? large.plugins : {}),
      legend: { display: datasets.length > 1 },
      tooltip: { callbacks: { label } },
    },
  };

  return {
    type: bars ? "bar" : "line",
    data: { datasets: chartDatasets },
    options,
  };
};
