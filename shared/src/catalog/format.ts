import type { MetricId } from "../primitives";
import { METRICS, type Unit } from "./metrics";

const LOCALE = "pt-BR";

export interface FormatOptions {
  /** Short form for big numbers (e.g. "21,0 mi"), used by KPIs and axes. */
  compact?: boolean;
}

const NOT_AVAILABLE = "—";

const number = (value: number, digits: number, compact: boolean): string =>
  new Intl.NumberFormat(LOCALE, {
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : digits,
    maximumFractionDigits: compact ? 1 : digits,
  }).format(value);

/** Seconds → "12 min 30 s", "1 h 05 min" or "45 s". */
export const formatDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  if (total < 60) return `${String(total)} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    const rest = total % 60;
    return rest === 0
      ? `${String(minutes)} min`
      : `${String(minutes)} min ${String(rest)} s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${String(hours)} h ${String(minutes % 60).padStart(2, "0")} min`;
};

export const formatValue = (
  value: number | null | undefined,
  unit: Unit,
  options: FormatOptions = {},
): string => {
  if (value === null || value === undefined || !Number.isFinite(value))
    return NOT_AVAILABLE;
  const compact = options.compact ?? false;
  switch (unit) {
    case "count":
      return number(value, 0, compact);
    case "usd":
      return new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency: "USD",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 2,
      }).format(value);
    case "percent":
      return `${number(value, 1, false)}%`;
    case "seconds":
      return formatDuration(value);
    case "miles":
      return `${number(value, 2, compact)} mi`;
    case "mph":
      return `${number(value, 1, false)} mph`;
  }
};

export const formatMetric = (
  id: MetricId,
  value: number | null | undefined,
  options?: FormatOptions,
): string => formatValue(value, METRICS[id].unit, options);

/** Signed percentage change, e.g. "+12,3%" / "−4,0%". */
export const formatDeltaPct = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value))
    return NOT_AVAILABLE;
  const formatted = number(Math.abs(value), 1, false);
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`;
  return `${formatted}%`;
};

/** Text shown when a metric does not exist for the selected services. */
export const NOT_APPLICABLE_LABEL = "Não se aplica";
