import {
  formatMetric,
  formatValue,
  METRICS,
  type Status,
} from "@ny-dashboard/shared";
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useMemo } from "react";
import { Line } from "react-chartjs-2";

import { useKpi } from "../../api/hooks";
import { sparklineDataset, sparklineOptions } from "../../charts/chartTheme";
import { useChartTheme } from "../../charts/useChartTheme";
import { periodLabel } from "../../components/filters/periods";
import { cn } from "../../components/ui";
import { DeltaBadge } from "../DeltaBadge";
import type { WidgetProps } from "../types";
import { WidgetBody } from "../WidgetBody";
import {
  sparkPoints,
  STATUS_LABELS,
  targetProgress,
  toKpiRequest,
} from "./transform";

const SPARKLINE_OPTIONS = sparklineOptions();

const STATUS_STYLE: Readonly<
  Record<Status, { icon: typeof CircleCheck; className: string }>
> = {
  good: {
    icon: CircleCheck,
    className: "bg-good text-white shadow-[0_0_18px_-4px_var(--nyd-good)]",
  },
  warning: {
    icon: TriangleAlert,
    className:
      "bg-warning text-[#0b0b0b] shadow-[0_0_18px_-4px_var(--nyd-warning)]",
  },
  bad: {
    icon: CircleAlert,
    className:
      "bg-critical text-white shadow-[0_0_18px_-4px_var(--nyd-critical)]",
  },
  neutral: {
    icon: CircleMinus,
    className: "border border-border bg-surface-2 text-ink-2",
  },
};

/** Status with icon + text (the text hides on very narrow cards but stays for screen readers). */
export function KpiStatus({ status }: { status: Status }) {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      <Icon size={13} aria-hidden />
      <span className="sr-only @[11rem]:not-sr-only">
        {STATUS_LABELS[status]}
      </span>
    </span>
  );
}

/**
 * KPI card (#46): value, status (good/warning/bad) with icon and glow, change against the
 * compared period, target progress and sparkline. Container queries drop the secondary lines
 * on narrow cards (mobile 1 column).
 */
export function KpiWidget({ widget, filters }: WidgetProps<"kpi">) {
  const theme = useChartTheme();
  const request = useMemo(
    () => toKpiRequest(widget, filters),
    [widget, filters],
  );
  const query = useKpi(request);
  const response = query.data;
  const metric = METRICS[widget.metric];
  const direction = widget.evaluation.direction ?? metric.direction;

  const spark = useMemo(
    () =>
      response?.sparkline
        ? {
            datasets: [
              { ...sparklineDataset(theme), data: sparkPoints(response) },
            ],
          }
        : null,
    [response, theme],
  );

  if (query.isPending) return <WidgetBody status="loading" skeleton="kpi" />;
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
  if (response.value === null) return <WidgetBody status="empty" />;

  const comparison = response.comparison;
  const comparedLabel =
    request.comparison.mode === "projection"
      ? "projeção"
      : comparison
        ? periodLabel(comparison.range)
        : null;
  const progress = targetProgress(response);

  return (
    <div
      className={cn(
        "@container flex h-full min-h-0 flex-col gap-1 overflow-hidden transition-opacity",
        query.isPlaceholderData && "opacity-60",
      )}
    >
      <p
        className="shrink-0 truncate text-xl leading-tight font-semibold text-ink tabular-nums @[12rem]:text-2xl @[18rem]:text-3xl"
        title={formatMetric(widget.metric, response.value)}
      >
        {formatMetric(widget.metric, response.value, { compact: true })}
      </p>
      <p
        className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-ink-2"
        title={
          comparison
            ? `vs. ${comparedLabel ?? ""}: ${formatMetric(widget.metric, comparison.value)}`
            : undefined
        }
      >
        <KpiStatus status={response.status} />
        {comparison && (
          <>
            <DeltaBadge
              deltaPct={comparison.deltaPct}
              direction={direction}
              neutralBandPct={
                widget.evaluation.comparison.enabled
                  ? widget.evaluation.comparison.neutralBandPct
                  : 0
              }
            />
            <span className="hidden truncate @[15rem]:inline">
              vs. {comparedLabel}:{" "}
              <span className="tabular-nums">
                {formatMetric(widget.metric, comparison.value, {
                  compact: true,
                })}
              </span>
            </span>
          </>
        )}
      </p>
      {response.target !== null && (
        <div className="hidden shrink-0 flex-col gap-1 text-xs text-ink-2 @[11rem]:flex">
          <span className="flex items-center gap-1">
            <Target size={12} className="text-muted" aria-hidden />
            Meta{" "}
            {formatMetric(widget.metric, response.target, { compact: true })}
            {progress !== null && (
              <span className="text-muted">
                · {formatValue(progress, "percent")}
              </span>
            )}
          </span>
          {progress !== null && (
            <span
              className="h-1 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Progresso da meta"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className="block h-full rounded-full bg-accent-gradient"
                style={{
                  width: `${String(Math.min(100, Math.max(0, progress)))}%`,
                }}
              />
            </span>
          )}
        </div>
      )}
      {spark && (
        <div className="relative -mx-1 min-h-0 flex-1" aria-hidden>
          <Line data={spark} options={SPARKLINE_OPTIONS} />
        </div>
      )}
    </div>
  );
}
