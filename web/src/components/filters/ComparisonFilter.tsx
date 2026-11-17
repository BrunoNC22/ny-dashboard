import type { Comparison, DateRange } from "@ny-dashboard/shared";
import { Check, GitCompareArrows } from "lucide-react";

import { cn, Popover } from "../ui";
import { FilterChip } from "./FilterChip";
import { DateRangeFields } from "./PeriodFilter";
import {
  COMPARISON_LABELS,
  comparisonLabel,
  periodLabel,
  rangeBefore,
} from "./periods";

const MODES = [
  "previous_period",
  "previous_year",
  "projection",
  "custom",
  "none",
] as const satisfies readonly Comparison["mode"][];

export interface ComparisonFilterProps {
  value: Comparison;
  period: DateRange;
  coverage: DateRange;
  /** Days with a projection (backtest + forecast); null when unknown. */
  projection: DateRange | null;
  onChange: (comparison: Comparison) => void;
}

/** Comparison mode (CLAUDE.md §6.2): previous period, previous year, projection, custom. */
export function ComparisonFilter({
  value,
  period,
  coverage,
  projection,
  onChange,
}: ComparisonFilterProps) {
  const projectionAvailable =
    projection === null ||
    (period.from >= projection.from && period.to <= projection.to);
  const projectionHint =
    projection && !projectionAvailable ? periodLabel(projection) : null;
  const customRange =
    value.mode === "custom" ? value.range : rangeBefore(period);

  return (
    <Popover
      label="Comparação"
      align="start"
      className="w-80"
      trigger={(props) => (
        <FilterChip
          {...props}
          icon={<GitCompareArrows size={16} />}
          name="Comparação"
          value={comparisonLabel(value)}
          active={value.mode !== "none"}
        />
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-0.5" role="radiogroup">
          {MODES.map((mode) => {
            const disabled = mode === "projection" && !projectionAvailable;
            const checked = value.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => {
                  if (mode === "custom") {
                    onChange({ mode, range: customRange });
                    return;
                  }
                  onChange({ mode });
                  close();
                }}
                className={cn(
                  "flex items-start gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-ink transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40",
                  checked && "bg-surface-2",
                )}
              >
                <span className="flex flex-1 flex-col">
                  {COMPARISON_LABELS[mode]}
                  {disabled && projectionHint !== null && (
                    <span className="text-xs text-muted">
                      Disponível entre {projectionHint}
                    </span>
                  )}
                </span>
                {checked && (
                  <Check size={16} className="text-accent" aria-hidden />
                )}
              </button>
            );
          })}
          {value.mode === "custom" && (
            <div className="mt-2 border-t border-border px-1 pt-3">
              <DateRangeFields
                key={`${customRange.from}|${customRange.to}`}
                value={customRange}
                limits={coverage}
                applyLabel="Comparar com este intervalo"
                onApply={(range) => {
                  onChange({ mode: "custom", range });
                  close();
                }}
              />
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
