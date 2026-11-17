import { formatValue, METRICS } from "@ny-dashboard/shared";
import { useMemo } from "react";
import { Chart } from "react-chartjs-2";

import { useTimeseries } from "../../api/hooks";
import { crosshairPlugin } from "../../charts/chartTheme";
import { useChartTheme } from "../../charts/useChartTheme";
import { periodLabel } from "../../components/filters/periods";
import { cn } from "../../components/ui";
import { DeltaBadge } from "../DeltaBadge";
import type { WidgetProps } from "../types";
import { WidgetBody } from "../WidgetBody";
import { WidgetNotices } from "../WidgetNotices";
import { seriesChartConfig } from "./seriesChart";
import {
  buildDatasets,
  hasData,
  projectionDeviations,
  toMillis,
  toSeriesQuery,
} from "./transform";

/**
 * Line, area, bar and stacked bar over time (#43): current series solid, comparison dashed
 * and aligned on the current period, projection dotted with large deviations highlighted.
 */
export function TimeSeriesWidget({
  widget,
  filters,
}: WidgetProps<"line" | "area" | "bar" | "stacked_bar">) {
  const theme = useChartTheme();
  const { request, blocked, notices } = useMemo(
    () => toSeriesQuery(widget, filters),
    [widget, filters],
  );
  const query = useTimeseries(request, { enabled: blocked === null });
  const response = query.data;
  const metric = METRICS[widget.metric];

  const config = useMemo(() => {
    if (!response) return null;
    const datasets = buildDatasets(response, {
      widget,
      periodFrom: request.filters.period.from,
      comparisonMode: request.comparison.mode,
      comparisonLabel: response.comparison
        ? periodLabel(response.comparison.range)
        : "",
    });
    const current = datasets.filter((d) => d.role === "current");
    const projection = datasets.find((d) => d.role === "projection");
    const deviations =
      current.length === 1 && current[0] && projection
        ? projectionDeviations(current[0].points, projection.points)
        : undefined;
    return seriesChartConfig(datasets, {
      type: widget.type,
      theme,
      unit: response.unit,
      granularity: widget.granularity,
      direction: metric.direction,
      deviations,
      xRange: {
        min: toMillis(request.filters.period.from),
        max:
          toMillis(request.filters.period.to) +
          (widget.granularity === "hour" ? 23 * 3_600_000 : 0),
      },
    });
  }, [response, widget, request, theme, metric.direction]);

  if (blocked !== null) {
    return <WidgetBody status="not_applicable" message={blocked} />;
  }
  if (query.isPending) return <WidgetBody status="loading" />;
  if (query.isError || !response) {
    return (
      <WidgetBody
        status="error"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (response.notApplicable) return <WidgetBody status="not_applicable" />;
  if (!hasData(response) || !config) return <WidgetBody status="empty" />;

  const totals = response.comparison?.totals;
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-1.5 transition-opacity",
        query.isPlaceholderData && "opacity-60",
      )}
    >
      {totals && response.comparison && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-2">
          <span>
            <span className="text-muted">
              {periodLabel(request.filters.period)}:
            </span>{" "}
            <span className="font-semibold text-ink tabular-nums">
              {formatValue(totals.current, response.unit, { compact: true })}
            </span>
          </span>
          <span>
            <span className="text-muted">
              {request.comparison.mode === "projection"
                ? "Projeção"
                : periodLabel(response.comparison.range)}
              :
            </span>{" "}
            <span className="tabular-nums">
              {formatValue(totals.comparison, response.unit, {
                compact: true,
              })}
            </span>
          </span>
          <DeltaBadge deltaPct={totals.deltaPct} direction={metric.direction} />
        </p>
      )}
      <div className="relative min-h-0 flex-1" data-no-drag>
        <Chart
          type={config.type}
          data={config.data}
          options={config.options}
          plugins={[crosshairPlugin(theme)]}
          aria-label={`Gráfico: ${widget.title}`}
          role="img"
        />
      </div>
      <WidgetNotices notices={[...notices, ...response.notices]} />
    </div>
  );
}
