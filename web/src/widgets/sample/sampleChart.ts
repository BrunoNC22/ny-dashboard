import {
  formatValue,
  TRIP_FIELDS_CATALOG,
  type TripField,
} from "@ny-dashboard/shared";
import type {
  ChartData,
  ChartOptions,
  ChartType,
  Plugin,
  TooltipItem,
} from "chart.js";

import {
  type ChartTheme,
  seriesColor,
  withAlpha,
} from "../../charts/chartTheme";
import { HOVER_LIMIT, type SampleDataset, type SamplePoint } from "./transform";

type JsType = "scatter" | "bubble";

export interface SampleChartOptions {
  type: JsType;
  theme: ChartTheme;
  x: TripField;
  y: TripField;
  r?: TripField;
}

const axis = (field: TripField) => {
  const { label, unit } = TRIP_FIELDS_CATALOG[field];
  return {
    type: "linear" as const,
    beginAtZero: true,
    title: { display: true, text: label },
    ticks: {
      maxTicksLimit: 6,
      callback: (value: number | string) =>
        formatValue(Number(value), unit, { compact: true }),
    },
  };
};

/**
 * Scatter/bubble over the trip sample: no animation, tiny translucent points;
 * hover off above HOVER_LIMIT points (CLAUDE.md §8: the 1M-point case is slow on purpose).
 * Scatter uses `parsing: false`, which makes Chart.js assume data sorted by x:
 * `toSampleDatasets` sorts it.
 */
export const sampleChartConfig = (
  datasets: readonly SampleDataset[],
  { type, theme, x, y, r }: SampleChartOptions,
) => {
  const total = datasets.reduce((sum, d) => sum + d.points.length, 0);
  const radius = total > 50_000 ? 1.2 : total > 5_000 ? 2 : 3;
  const hover = total <= HOVER_LIMIT;
  const xUnit = TRIP_FIELDS_CATALOG[x].unit;
  const yUnit = TRIP_FIELDS_CATALOG[y].unit;

  const data: ChartData<JsType, SamplePoint[]> = {
    datasets: datasets.map((dataset) => {
      const color = seriesColor(theme, dataset.slot);
      return {
        label: `${dataset.label} (${formatValue(dataset.points.length, "count")})`,
        data: dataset.points,
        pointStyle: dataset.pointStyle,
        backgroundColor: withAlpha(color, type === "bubble" ? 0.35 : 0.55),
        borderColor: color,
        borderWidth: type === "bubble" ? 1 : 0,
        ...(type === "scatter" ? { pointRadius: radius } : {}),
        pointHoverRadius: radius + 2,
      };
    }),
  };

  const label = (item: TooltipItem<JsType>) => {
    const point = item.raw as SamplePoint;
    const name = datasets[item.datasetIndex]?.label ?? "";
    return `${name}: ${formatValue(point.x, xUnit)} × ${formatValue(point.y, yUnit)}${
      r ? ` · ${TRIP_FIELDS_CATALOG[r].label.toLowerCase()} ∝ raio` : ""
    }`;
  };

  const options: ChartOptions<JsType> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    // Bubbles need Chart.js parsing: with `parsing: false` it ignores `r` (it expects its
    // internal `_custom` radius) and falls back to the global point radius, 0 here.
    ...(type === "scatter" ? { parsing: false, normalized: true } : {}),
    ...(hover ? {} : { events: [] }),
    interaction: { mode: "nearest", intersect: true },
    scales: { x: axis(x), y: axis(y) },
    plugins: {
      legend: { display: datasets.length > 1 },
      tooltip: { enabled: hover, callbacks: { label } },
    },
  };

  return { data, options, total, hover };
};

/** Measures chart creation → first finished draw (layout + drawing) and reports it once. */
export const renderTimer = <T extends ChartType = ChartType>(
  onMeasured: (ms: number) => void,
): Plugin<T> => {
  let start = 0;
  let done = false;
  return {
    id: "nydRenderTimer",
    beforeInit() {
      start = performance.now();
    },
    afterRender() {
      if (done) return;
      done = true;
      onMeasured(performance.now() - start);
    },
  };
};
