import type { DateRange } from "@ny-dashboard/shared";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button, cn, IconButton, Input, Popover } from "../ui";
import { FilterChip } from "./FilterChip";
import {
  lastWholeMonth,
  MONTH_SHORT,
  monthRange,
  monthsBetween,
  periodLabel,
  wholeMonth,
} from "./periods";

export interface DateRangeFieldsProps {
  value: DateRange;
  limits: DateRange;
  onApply: (range: DateRange) => void;
  applyLabel?: string;
}

/** From/to date inputs bounded by the data coverage. */
export function DateRangeFields({
  value,
  limits,
  onApply,
  applyLabel = "Aplicar",
}: DateRangeFieldsProps) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const invalid =
    !from || !to || from > to || from < limits.from || to > limits.to;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="De"
          type="date"
          value={from}
          min={limits.from}
          max={limits.to}
          onChange={(event) => {
            setFrom(event.target.value);
          }}
        />
        <Input
          label="Até"
          type="date"
          value={to}
          min={limits.from}
          max={limits.to}
          onChange={(event) => {
            setTo(event.target.value);
          }}
        />
      </div>
      <Button
        size="sm"
        variant="primary"
        disabled={invalid}
        onClick={() => {
          onApply({ from, to });
        }}
      >
        {applyLabel}
      </Button>
    </div>
  );
}

export interface PeriodFilterProps {
  value: DateRange;
  coverage: DateRange;
  onChange: (range: DateRange) => void;
}

/** Quick month picker (by year) + custom range, limited to the data coverage. */
export function PeriodFilter({ value, coverage, onChange }: PeriodFilterProps) {
  const available = monthsBetween(coverage).filter((month) => {
    const range = monthRange(month);
    return range.from >= coverage.from && range.to <= coverage.to;
  });
  const years = [...new Set(available.map((m) => m.slice(0, 4)))];
  const selectedMonth = wholeMonth(value);
  const [year, setYear] = useState(
    value.from.slice(0, 4) || (years.at(-1) ?? ""),
  );
  const yearIndex = years.indexOf(year);
  const latest = lastWholeMonth(coverage);

  return (
    <Popover
      label="Período"
      align="start"
      className="w-80"
      trigger={(props) => (
        <FilterChip
          {...props}
          icon={<CalendarDays size={16} />}
          name="Período"
          value={periodLabel(value)}
          active
        />
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-3 p-1">
          <div className="flex items-center justify-between">
            <IconButton
              size="sm"
              label="Ano anterior"
              icon={<ChevronLeft size={16} />}
              disabled={yearIndex <= 0}
              onClick={() => {
                setYear(years[yearIndex - 1] ?? year);
              }}
            />
            <span className="text-sm font-semibold text-ink">{year}</span>
            <IconButton
              size="sm"
              label="Próximo ano"
              icon={<ChevronRight size={16} />}
              disabled={yearIndex >= years.length - 1}
              onClick={() => {
                setYear(years[yearIndex + 1] ?? year);
              }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTH_SHORT.map((label, i) => {
              const month = `${year}-${String(i + 1).padStart(2, "0")}`;
              const enabled = available.includes(month);
              const active = month === selectedMonth;
              return (
                <button
                  key={month}
                  type="button"
                  disabled={!enabled}
                  aria-pressed={active}
                  aria-label={`${label}/${year}`}
                  onClick={() => {
                    onChange(monthRange(month));
                    close();
                  }}
                  className={cn(
                    "h-9 rounded-lg text-sm capitalize transition disabled:opacity-30",
                    active
                      ? "bg-accent-gradient font-semibold text-on-accent"
                      : "text-ink hover:bg-surface-2",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange(latest);
              close();
            }}
          >
            Último mês disponível ({periodLabel(latest)})
          </Button>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              Intervalo personalizado
            </p>
            <DateRangeFields
              value={value}
              limits={coverage}
              onApply={(range) => {
                onChange(range);
                close();
              }}
            />
          </div>
        </div>
      )}
    </Popover>
  );
}
