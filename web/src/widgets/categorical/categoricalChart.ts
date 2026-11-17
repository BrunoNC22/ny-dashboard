import { formatValue, type Unit } from "@ny-dashboard/shared";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";

import {
  type ChartTheme,
  comparisonStyle,
  seriesColor,
  withAlpha,
} from "../../charts/chartTheme";
import type { Category } from "./transform";

export type CategoricalChartType =
  "doughnut" | "pie" | "radar" | "polar_area" | "bar_horizontal";
type JsType = "doughnut" | "pie" | "radar" | "polarArea" | "bar";

export interface CategoricalChartConfig {
  type: JsType;
  data: ChartData<JsType, (number | null)[], string>;
  options: ChartOptions<JsType>;
}

export const categoryColor = (theme: ChartTheme, category: Category) =>
  category.slot < 0 ? theme.other : seriesColor(theme, category.slot);

export interface CategoricalChartOptions {
  type: CategoricalChartType;
  theme: ChartTheme;
  unit: Unit;
  /** Label of the current / compared period for legends and tooltips. */
  currentLabel: string;
  comparisonLabel: string | null;
}

/**
 * Chart.js config for categorical widgets. Doughnut, pie and polar area color each category
 * (legend drawn in HTML next to them); radar and ranking bars are one series (one hue) with
 * the compared period dashed / ghosted.
 */
export const categoricalChartConfig = (
  categories: readonly Category[],
  { type, theme, unit, currentLabel, comparisonLabel }: CategoricalChartOptions,
): CategoricalChartConfig => {
  const labels = categories.map((c) => c.label);
  const values = categories.map((c) => c.value);
  const compared = categories.map((c) => c.comparisonValue);
  const format = (value: unknown) =>
    formatValue(typeof value === "number" ? value : null, unit);
  const tooltipLabel = (item: TooltipItem<JsType>) =>
    `${item.dataset.label ?? item.label}: ${format(item.raw)}`;
  const tooltip = { callbacks: { label: tooltipLabel } };

  if (type === "doughnut" || type === "pie" || type === "polar_area") {
    const colors = categories.map((c) => categoryColor(theme, c));
    return {
      type: type === "polar_area" ? "polarArea" : type,
      data: {
        labels,
        datasets: [
          {
            label: currentLabel,
            data: values,
            backgroundColor:
              type === "polar_area"
                ? colors.map((c) => withAlpha(c, 0.75))
                : colors,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(type === "doughnut" ? { cutout: "68%" } : {}),
        ...(type === "polar_area"
          ? {
              scales: {
                r: { ticks: { display: false }, beginAtZero: true },
              },
            }
          : {}),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<JsType>) =>
                `${item.label}: ${format(item.raw)}`,
            },
          },
        },
      },
    };
  }

  const color = seriesColor(theme, 0);
  const comparison =
    comparisonLabel !== null && compared.some((v) => v !== null);

  if (type === "radar") {
    return {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: currentLabel,
            data: values,
            borderColor: color,
            backgroundColor: withAlpha(color, 0.22),
            pointBackgroundColor: color,
            pointRadius: 2,
            fill: true,
          },
          ...(comparison
            ? [
                {
                  label: comparisonLabel,
                  data: compared,
                  ...comparisonStyle(color),
                  backgroundColor: "transparent",
                  pointRadius: 0,
                  fill: false,
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { beginAtZero: true, ticks: { display: false } } },
        plugins: { legend: { display: comparison }, tooltip },
      },
    };
  }

  // Ranking: horizontal bars, one hue; the compared period as a ghost bar behind.
  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: currentLabel,
          data: values,
          backgroundColor: categories.map((c) =>
            c.slot < 0 ? theme.other : color,
          ),
          borderRadius: 4,
          maxBarThickness: 18,
          order: 0,
        },
        ...(comparison
          ? [
              {
                label: comparisonLabel,
                data: compared,
                backgroundColor: withAlpha(color, 0.18),
                borderColor: withAlpha(color, 0.6),
                borderWidth: 1,
                borderDash: [4, 3],
                borderRadius: 4,
                maxBarThickness: 18,
                order: 1,
              },
            ]
          : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            maxTicksLimit: 5,
            callback: (value: number | string) =>
              formatValue(Number(value), unit, { compact: true }),
          },
        },
        y: { grid: { display: false }, ticks: { autoSkip: false } },
      },
      plugins: { legend: { display: comparison }, tooltip },
    },
  };
};
