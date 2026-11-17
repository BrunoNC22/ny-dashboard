import {
  comparisonRange,
  formatValue,
  type MetricDirection,
  METRICS,
  type Unit,
} from "@ny-dashboard/shared";
import { useMemo } from "react";
import { Chart } from "react-chartjs-2";

import { useBreakdown } from "../../api/hooks";
import { type ChartTheme } from "../../charts/chartTheme";
import { useChartTheme } from "../../charts/useChartTheme";
import { periodLabel } from "../../components/filters/periods";
import { cn } from "../../components/ui";
import { DeltaBadge } from "../DeltaBadge";
import type { WidgetProps } from "../types";
import { WidgetBody } from "../WidgetBody";
import { WidgetNotices } from "../WidgetNotices";
import { categoricalChartConfig, categoryColor } from "./categoricalChart";
import {
  type Category,
  hasComparison,
  shareOf,
  toBreakdownQuery,
  toCategories,
} from "./transform";

function CategoryLegend({
  categories,
  theme,
  unit,
  additive,
  direction,
}: {
  categories: readonly Category[];
  theme: ChartTheme;
  unit: Unit;
  additive: boolean;
  direction: MetricDirection;
}) {
  const { share } = shareOf(categories);
  const compare = hasComparison(categories);
  return (
    <ul
      className="flex min-h-0 flex-col gap-1 overflow-y-auto text-xs"
      data-no-drag
    >
      {categories.map((category) => {
        const pct = additive ? share(category.value) : null;
        return (
          <li
            key={category.key}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: categoryColor(theme, category) }}
              aria-hidden
            />
            <span className="truncate text-ink-2" title={category.label}>
              {category.label}
            </span>
            <span className="text-right text-ink tabular-nums">
              {formatValue(category.value, unit, { compact: true })}
              {pct !== null && (
                <span className="ml-1 text-muted">
                  {formatValue(pct, "percent")}
                </span>
              )}
            </span>
            {compare ? (
              <DeltaBadge deltaPct={category.deltaPct} direction={direction} />
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Doughnut/pie (total in the middle), polar area, radar and ranking bars over one dimension
 * (#44), with the compared period where it reads well: radar dashed, ranking ghost bars,
 * doughnut/pie/polar deltas in the legend.
 */
export function CategoricalWidget({
  widget,
  filters,
}: WidgetProps<
  "doughnut" | "pie" | "radar" | "polar_area" | "bar_horizontal"
>) {
  const theme = useChartTheme();
  const { request, blocked } = useMemo(
    () => toBreakdownQuery(widget, filters),
    [widget, filters],
  );
  const query = useBreakdown(request, { enabled: blocked === null });
  const response = query.data;
  const metric = METRICS[widget.metric];

  const categories = useMemo(
    () =>
      response
        ? toCategories(response, widget.dimension, {
            withOthers:
              widget.type !== "bar_horizontal" && widget.type !== "radar",
          })
        : [],
    [response, widget.dimension, widget.type],
  );
  const comparisonLabel = useMemo(() => {
    if (filters.comparison.mode === "none") return null;
    if (filters.comparison.mode === "projection") return "Projeção";
    const range = comparisonRange(filters.period, filters.comparison);
    return range ? periodLabel(range) : null;
  }, [filters.period, filters.comparison]);
  const config = useMemo(
    () =>
      response
        ? categoricalChartConfig(categories, {
            type: widget.type,
            theme,
            unit: response.unit,
            currentLabel: periodLabel(filters.period),
            comparisonLabel,
          })
        : null,
    [response, categories, widget.type, theme, filters.period, comparisonLabel],
  );

  if (blocked !== null) {
    return <WidgetBody status="not_applicable" message={blocked} />;
  }
  if (query.isPending) return <WidgetBody status="loading" />;
  if (query.isError || !response || !config) {
    return (
      <WidgetBody
        status="error"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (response.notApplicable) {
    return <WidgetBody status="not_applicable" message={response.notices[0]} />;
  }
  if (!categories.some((c) => c.value !== null && c.value !== 0)) {
    return <WidgetBody status="empty" />;
  }

  const withLegend =
    widget.type === "doughnut" ||
    widget.type === "pie" ||
    widget.type === "polar_area";
  const { total } = shareOf(categories);
  const comparisonTotal = categories.reduce(
    (sum, c) => sum + (c.comparisonValue ?? 0),
    0,
  );
  const showCenter = widget.type === "doughnut" && metric.additive;

  const chart = (
    <div className="relative min-h-0 min-w-0 flex-1" data-no-drag>
      <Chart
        type={config.type}
        data={config.data}
        options={config.options}
        role="img"
        aria-label={`Gráfico: ${widget.title}`}
      />
      {showCenter && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg leading-tight font-semibold text-ink tabular-nums">
            {formatValue(total, response.unit, { compact: true })}
          </span>
          <span className="text-[11px] text-muted">total</span>
          {hasComparison(categories) && comparisonTotal !== 0 && (
            <DeltaBadge
              className="mt-1"
              deltaPct={((total - comparisonTotal) / comparisonTotal) * 100}
              direction={metric.direction}
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "@container flex h-full flex-col gap-1.5 transition-opacity",
        query.isPlaceholderData && "opacity-60",
      )}
    >
      {withLegend ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 @md:flex-row @md:items-center">
          {chart}
          <div className="flex max-h-[45%] min-h-0 flex-col @md:max-h-full @md:w-[48%]">
            <CategoryLegend
              categories={categories}
              theme={theme}
              unit={response.unit}
              additive={metric.additive}
              direction={metric.direction}
            />
          </div>
        </div>
      ) : (
        chart
      )}
      <WidgetNotices notices={response.notices} />
    </div>
  );
}
