import {
  type Comparison,
  type DateRange,
  formatIsoDate,
} from "@ny-dashboard/shared";

export const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-09" → { from: "2026-09-01", to: "2026-09-30" }. */
export const monthRange = (month: string): DateRange => {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
};

/** The month (YYYY-MM) if the range is exactly one whole month, else null. */
export const wholeMonth = (range: DateRange): string | null => {
  const month = range.from.slice(0, 7);
  const full = monthRange(month);
  return full.from === range.from && full.to === range.to ? month : null;
};

/** Months (YYYY-MM) touched by the range, oldest first. */
export const monthsBetween = (range: DateRange): string[] => {
  const months: string[] = [];
  let [year = 0, mon = 1] = range.from.split("-").map(Number);
  const end = range.to.slice(0, 7);
  for (;;) {
    const month = `${String(year)}-${pad(mon)}`;
    months.push(month);
    if (month >= end) return months;
    mon += 1;
    if (mon > 12) {
      mon = 1;
      year += 1;
    }
  }
};

/** Default period: the last whole month with data (CLAUDE.md §6.2). */
export const lastWholeMonth = (coverage: DateRange): DateRange => {
  const lastMonth = coverage.to.slice(0, 7);
  const range = monthRange(lastMonth);
  if (range.to === coverage.to) return range;
  const [year = 0, mon = 1] = lastMonth.split("-").map(Number);
  return monthRange(
    mon === 1 ? `${String(year - 1)}-12` : `${String(year)}-${pad(mon - 1)}`,
  );
};

/** "09/2026" for a whole month, "01/09/2026 – 15/09/2026" otherwise. */
export const periodLabel = (range: DateRange): string => {
  const month = wholeMonth(range);
  if (month) return formatIsoDate(month);
  if (range.from === range.to) return formatIsoDate(range.from);
  return `${formatIsoDate(range.from)} – ${formatIsoDate(range.to)}`;
};

export const COMPARISON_LABELS: Readonly<Record<Comparison["mode"], string>> = {
  none: "Sem comparação",
  previous_period: "Período anterior",
  previous_year: "Mesmo período do ano anterior",
  custom: "Intervalo personalizado",
  projection: "Projeção × real",
};

/** Short chip text: "vs. período anterior", "vs. 01/08/2026 – 15/08/2026"… */
export const comparisonLabel = (comparison: Comparison): string => {
  switch (comparison.mode) {
    case "none":
      return "Sem comparação";
    case "previous_period":
      return "vs. período anterior";
    case "previous_year":
      return "vs. ano anterior";
    case "projection":
      return "vs. projeção";
    case "custom":
      return `vs. ${periodLabel(comparison.range)}`;
  }
};

/** Same number of days right before the range (default for a custom comparison). */
export const rangeBefore = (range: DateRange): DateRange => {
  const day = 86_400_000;
  const from = Date.parse(`${range.from}T00:00:00Z`);
  const to = Date.parse(`${range.to}T00:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(from - (to - from) - day), to: iso(from - day) };
};
