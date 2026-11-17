import {
  DIMENSION_DEFINITIONS,
  formatMetric,
  METRICS,
} from "@ny-dashboard/shared";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo } from "react";

import { useBreakdowns } from "../../api/hooks";
import { cn } from "../../components/ui";
import { useDashboardStore } from "../../stores/dashboardStore";
import { DeltaBadge } from "../DeltaBadge";
import type { WidgetProps } from "../types";
import { WidgetBody } from "../WidgetBody";
import { WidgetNotices } from "../WidgetNotices";
import { columnMax, joinColumns, nextSort, toTableRequests } from "./transform";

/**
 * Ranking table (#47): configurable metric columns, sortable headers (saved in the widget,
 * undoable), change of the sorting column against the compared period and inline mini-bars.
 * Scrolls inside the widget with a sticky header.
 */
export function TableWidget({
  widget,
  filters,
  preview,
}: WidgetProps<"table">) {
  const updateWidget = useDashboardStore((s) => s.updateWidget);
  const requests = useMemo(
    () => toTableRequests(widget, filters),
    [widget, filters],
  );
  const queries = useBreakdowns(requests);
  const responses = queries.map((q) => q.data);
  const sortIndex = widget.columns.indexOf(widget.sortBy);
  const ranked = responses[sortIndex];
  // Cheap (≤ 100 ranked rows): no memo needed.
  const rows = joinColumns(widget, responses);
  const showDelta = filters.comparison.mode !== "none";

  if (queries[sortIndex]?.isPending)
    return <WidgetBody status="loading" skeleton="table" />;
  if (queries[sortIndex]?.isError || !ranked) {
    return (
      <WidgetBody
        status="error"
        onRetry={() => {
          for (const q of queries) void q.refetch();
        }}
      />
    );
  }
  if (ranked.notApplicable) {
    return <WidgetBody status="not_applicable" message={ranked.notices[0]} />;
  }
  if (rows.length === 0) return <WidgetBody status="empty" />;

  const max = columnMax(rows, widget.sortBy);
  const sortMetric = METRICS[widget.sortBy];
  const notices = [...new Set(responses.flatMap((r) => r?.notices ?? []))];

  const sortBy = (metric: (typeof widget.columns)[number]) => {
    if (preview) return;
    updateWidget({ ...widget, ...nextSort(widget, metric) });
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-1.5 transition-opacity",
        queries.some((q) => q.isPlaceholderData) && "opacity-60",
      )}
    >
      <div className="min-h-0 flex-1 overflow-auto rounded-lg" data-no-drag>
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="text-left text-muted">
              <th
                scope="col"
                className="w-6 border-b border-border py-1.5 pr-1 font-medium"
              >
                #
              </th>
              <th
                scope="col"
                className="border-b border-border py-1.5 pr-2 font-medium"
              >
                {DIMENSION_DEFINITIONS[widget.dimension].label}
              </th>
              {widget.columns.map((metric) => {
                const active = metric === widget.sortBy;
                const Icon = active
                  ? widget.sortDir === "desc"
                    ? ArrowDown
                    : ArrowUp
                  : ArrowUpDown;
                return (
                  <th
                    key={metric}
                    scope="col"
                    aria-sort={
                      active
                        ? widget.sortDir === "desc"
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                    className="border-b border-border py-1.5 pl-2 text-right font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        sortBy(metric);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded hover:text-ink",
                        active && "text-ink",
                      )}
                    >
                      {METRICS[metric].label}
                      <Icon size={11} aria-hidden />
                    </button>
                  </th>
                );
              })}
              {showDelta && (
                <th
                  scope="col"
                  className="border-b border-border py-1.5 pl-2 text-right font-medium"
                >
                  Var. {sortMetric.label.toLowerCase()}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const sorted = row.cells[widget.sortBy];
              const width =
                max > 0 ? (Math.abs(sorted?.value ?? 0) / max) * 100 : 0;
              return (
                <tr key={row.key} className="hover:bg-surface-2/60">
                  <td className="border-b border-border/60 py-1.5 pr-1 text-muted tabular-nums">
                    {index + 1}
                  </td>
                  <td
                    className="max-w-48 truncate border-b border-border/60 py-1.5 pr-2 text-ink"
                    title={row.label}
                  >
                    {row.label}
                  </td>
                  {widget.columns.map((metric) => {
                    const cell = row.cells[metric];
                    const active = metric === widget.sortBy;
                    return (
                      <td
                        key={metric}
                        className={cn(
                          "relative border-b border-border/60 py-1.5 pl-2 text-right whitespace-nowrap tabular-nums",
                          active ? "font-semibold text-ink" : "text-ink-2",
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="bg-accent-gradient absolute inset-y-1 right-0 rounded opacity-20"
                            style={{ width: `${String(width)}%` }}
                          />
                        )}
                        <span className="relative">
                          {formatMetric(metric, cell?.value ?? null, {
                            compact: true,
                          })}
                        </span>
                      </td>
                    );
                  })}
                  {showDelta && (
                    <td className="border-b border-border/60 py-1.5 pl-2 text-right">
                      <DeltaBadge
                        deltaPct={sorted?.deltaPct ?? null}
                        direction={sortMetric.direction}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <WidgetNotices notices={notices} />
    </div>
  );
}
