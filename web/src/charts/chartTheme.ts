/**
 * THE single place for Chart.js styling (CLAUDE.md §7). Everything visual about charts comes
 * from the design tokens (tokens.ts) and follows the data-viz method: thin 2px lines, 4px
 * rounded bar ends, 2px surface gaps between fills, recessive grid/axes, crosshair tooltips,
 * text in ink tokens (never in series colors) and categorical colors in fixed order.
 */
import "chartjs-adapter-date-fns";

import type { Palette, Theme } from "@ny-dashboard/shared";
import {
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Chart,
  type ChartArea,
  type ChartOptions,
  type ChartType,
  Decimation,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  type Plugin,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  ScatterController,
  TimeScale,
  TimeSeriesScale,
  Tooltip,
} from "chart.js";
import { ptBR } from "date-fns/locale";

import { BASE, POINT_STYLES, seriesColors, STATUS } from "../styles/tokens";

Chart.register(
  LineController,
  BarController,
  DoughnutController,
  PieController,
  RadarController,
  PolarAreaController,
  ScatterController,
  BubbleController,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Tooltip,
  Legend,
  Filler,
  Decimation,
);

// ── Theme ───────────────────────────────────────────────────────────────────────

export interface ChartTheme {
  theme: Theme;
  palette: Palette;
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  border: string;
  /** Categorical colors in fixed order (slot 1..8). */
  series: readonly string[];
  /** Neutral color for "Outros" / everything beyond the 8 slots. */
  other: string;
  status: typeof STATUS;
  fontFamily: string;
}

export const FONT_FAMILY =
  '"Inter Variable", ui-sans-serif, system-ui, sans-serif';

export const getChartTheme = (theme: Theme, palette: Palette): ChartTheme => {
  const base = BASE[theme];
  return {
    theme,
    palette,
    surface: base.surface,
    ink: base.ink,
    ink2: base.ink2,
    muted: base.muted,
    grid: base.grid,
    axis: base.axis,
    border: base.borderStrong,
    series: seriesColors(palette, theme),
    other: base.muted,
    status: STATUS,
    fontFamily: FONT_FAMILY,
  };
};

/** Color of the i-th series (fixed order; beyond the 8 slots → the neutral "Outros" color). */
export const seriesColor = (theme: ChartTheme, index: number): string =>
  theme.series[index] ?? theme.other;

/** Point shape paired with the i-th color (second channel for > 3 categories in scatter). */
export const pointStyle = (index: number) =>
  POINT_STYLES[index % POINT_STYLES.length];

/** #rrggbb → rgba() with alpha. */
export const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
};

// ── Global defaults ─────────────────────────────────────────────────────────────

/** Applies the theme to Chart.defaults (call again whenever theme/palette changes). */
export const applyChartDefaults = (theme: ChartTheme): void => {
  const d = Chart.defaults;
  d.locale = "pt-BR";
  d.font.family = theme.fontFamily;
  d.font.size = 11;
  d.color = theme.muted;
  d.borderColor = theme.grid;
  d.maintainAspectRatio = false;
  d.responsive = true;
  // Mutate (never replace) the animation defaults: Chart.js keeps internal settings there.
  Object.assign(d.animation as object, {
    duration: 450,
    easing: "easeOutCubic",
  });

  d.elements.line.borderWidth = 2;
  d.elements.line.tension = 0.3;
  d.elements.line.borderCapStyle = "round";
  d.elements.point.radius = 0;
  d.elements.point.hoverRadius = 4;
  d.elements.point.hitRadius = 8;
  d.elements.point.borderWidth = 2;
  d.elements.point.hoverBorderWidth = 2;
  d.elements.point.borderColor = theme.surface;
  d.elements.bar.borderRadius = 4;
  d.elements.bar.borderSkipped = "start";
  d.elements.bar.borderWidth = 0;
  d.elements.arc.borderWidth = 2;
  d.elements.arc.borderColor = theme.surface;

  d.plugins.legend.position = "bottom";
  d.plugins.legend.labels.color = theme.ink2;
  d.plugins.legend.labels.usePointStyle = true;
  d.plugins.legend.labels.pointStyleWidth = 10;
  d.plugins.legend.labels.boxHeight = 8;
  d.plugins.legend.labels.padding = 14;
  d.plugins.legend.labels.font = { size: 12 };

  const tooltip = d.plugins.tooltip;
  tooltip.backgroundColor = withAlpha(theme.surface, 0.96);
  tooltip.borderColor = theme.border;
  tooltip.borderWidth = 1;
  tooltip.titleColor = theme.ink;
  tooltip.bodyColor = theme.ink2;
  tooltip.footerColor = theme.muted;
  tooltip.padding = 10;
  tooltip.cornerRadius = 10;
  tooltip.boxPadding = 4;
  tooltip.usePointStyle = true;
  tooltip.titleFont = { weight: 600, size: 12 };
  tooltip.bodyFont = { size: 12 };
  tooltip.caretSize = 0;

  // Recessive axes and gridlines: cartesian scales share Chart.defaults.scale.
  Object.assign(d.scale.grid, { color: theme.grid, drawTicks: false });
  Object.assign((d.scale as unknown as { border: object }).border, {
    color: theme.axis,
    display: true,
  });
  Object.assign(d.scale.ticks, { color: theme.muted, padding: 6 });
  Object.assign(d.scales.radialLinear.grid, { color: theme.grid });
  Object.assign(d.scales.radialLinear.angleLines, { color: theme.grid });
  Object.assign(d.scales.radialLinear.pointLabels, {
    color: theme.ink2,
    font: { size: 11 },
  });
  Object.assign(d.scales.radialLinear.ticks, {
    color: theme.muted,
    backdropColor: "transparent",
  });
};

// ── Helpers for datasets ───────────────────────────────────────────────────────

/** Vertical gradient for area fills: series color fading into the surface. */
export const areaGradient = (
  ctx: CanvasRenderingContext2D,
  area: ChartArea,
  color: string,
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, withAlpha(color, 0.35));
  gradient.addColorStop(1, withAlpha(color, 0));
  return gradient;
};

/**
 * Scriptable background for area datasets (the gradient needs the chart area, which only
 * exists after layout).
 */
export const areaFill =
  (color: string) =>
  ({ chart }: { chart: Chart }): CanvasGradient | string => {
    const { ctx } = chart;
    // undefined until the first layout (the Chart.js type says otherwise)
    const chartArea = chart.chartArea as ChartArea | undefined;
    return chartArea
      ? areaGradient(ctx, chartArea, color)
      : withAlpha(color, 0.2);
  };

/** Comparison series (e.g. previous month): same hue, dashed and quieter. */
export const comparisonStyle = (color: string) => ({
  borderColor: withAlpha(color, 0.75),
  backgroundColor: withAlpha(color, 0.12),
  borderDash: [6, 4],
  borderWidth: 2,
});

/** Projection series (expected values): muted dotted line. */
export const projectionStyle = (theme: ChartTheme) => ({
  borderColor: theme.ink2,
  backgroundColor: "transparent",
  borderDash: [2, 4],
  borderWidth: 2,
});

/** Stacked bars: a 2px surface gap between segments. */
export const stackedBarStyle = (theme: ChartTheme, color: string) => ({
  backgroundColor: color,
  borderColor: theme.surface,
  borderWidth: { top: 2, bottom: 0, left: 0, right: 0 },
  borderSkipped: false as const,
  borderRadius: 4,
});

// ── Large data (CLAUDE.md §8) ──────────────────────────────────────────────────

/** Above this many points per series, animations go off and LTTB decimation kicks in. */
export const LARGE_SERIES_THRESHOLD = 1000;

/**
 * Options for big line/time series: no parsing (data as {x, y} numbers), no animation,
 * LTTB decimation down to ~2 points per pixel. Chart.js decimation needs a linear/time x axis.
 */
export const largeDataOptions = (points: number) =>
  points <= LARGE_SERIES_THRESHOLD
    ? {}
    : ({
        animation: false,
        parsing: false,
        normalized: true,
        spanGaps: true,
        plugins: {
          decimation: {
            enabled: true,
            algorithm: "lttb",
            samples: 1000,
            threshold: LARGE_SERIES_THRESHOLD,
          },
        },
      } as const);

/**
 * Time x axis with pt-BR formats per granularity. `auto` lets Chart.js pick the tick unit
 * (never finer than the granularity): 24 months of hourly data get monthly ticks, not 17k.
 */
export const timeScale = (
  unit: "hour" | "day" | "week" | "month",
  { auto = false }: { auto?: boolean } = {},
) => ({
  type: "time" as const,
  adapters: { date: { locale: ptBR } },
  time: {
    unit: auto ? (false as const) : unit,
    minUnit: unit,
    isoWeekday: true,
    tooltipFormat:
      unit === "hour"
        ? "dd/MM/yyyy HH'h'"
        : unit === "month"
          ? "MMMM 'de' yyyy"
          : "dd/MM/yyyy",
    displayFormats: {
      hour: "HH'h'",
      day: "dd/MM",
      week: "dd/MM",
      month: "MMM yy",
      quarter: "MMM yy",
      year: "yyyy",
    },
  },
  ticks: { maxRotation: 0, autoSkipPadding: 16 },
});

// ── Plugins ─────────────────────────────────────────────────────────────────────

/** Soft glow on line/radar strokes (shadow in the dataset's own color). */
export const glowPlugin: Plugin = {
  id: "nydGlow",
  beforeDatasetDraw(chart, { meta }) {
    const type = meta.type as ChartType;
    if (type !== "line" && type !== "radar") return;
    const dataset = chart.data.datasets[meta.index];
    const color =
      typeof dataset?.borderColor === "string"
        ? dataset.borderColor
        : undefined;
    if (!color || (dataset as { borderDash?: number[] }).borderDash?.length)
      return;
    chart.ctx.save();
    chart.ctx.shadowColor = color.startsWith("#")
      ? withAlpha(color, 0.55)
      : color;
    chart.ctx.shadowBlur = 10;
    chart.ctx.shadowOffsetY = 2;
  },
  afterDatasetDraw(chart, { meta }) {
    const type = meta.type as ChartType;
    const dataset = chart.data.datasets[meta.index];
    const color =
      typeof dataset?.borderColor === "string"
        ? dataset.borderColor
        : undefined;
    if (
      (type === "line" || type === "radar") &&
      color &&
      !(dataset as { borderDash?: number[] }).borderDash?.length
    ) {
      chart.ctx.restore();
    }
  },
};

/** Vertical crosshair at the hovered x (line/area charts). */
export const crosshairPlugin = <T extends ChartType = ChartType>(
  theme: ChartTheme,
): Plugin<T> => ({
  id: "nydCrosshair",
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    const first = active?.[0];
    if (!first) return;
    const { ctx, chartArea } = chart;
    const x = first.element.x;
    ctx.save();
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
});

Chart.register(glowPlugin);

/** Base options shared by every cartesian chart (interaction = crosshair + index tooltip). */
export const cartesianOptions = <T extends "line" | "bar">(): ChartOptions<T> =>
  ({
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: true } },
    scales: { y: { beginAtZero: true, ticks: { maxTicksLimit: 6 } } },
  }) as unknown as ChartOptions<T>;

/**
 * KPI sparkline: a bare area line (no axes, legend, tooltip or events), in the first series
 * color — status colors stay reserved for the status badge.
 */
export const sparklineOptions = (): ChartOptions<"line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  events: [],
  layout: { padding: { top: 2, bottom: 0 } },
  scales: {
    x: { type: "linear", display: false },
    y: { display: false, beginAtZero: false },
  },
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
});

export const sparklineDataset = (theme: ChartTheme) => {
  const color = seriesColor(theme, 0);
  return {
    borderColor: color,
    backgroundColor: areaFill(color),
    fill: "origin" as const,
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.35,
    spanGaps: true,
  };
};
