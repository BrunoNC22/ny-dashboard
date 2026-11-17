import type { Comparison } from "./filters";
import type { DateRange, Granularity } from "./primitives";

/** Date helpers on YYYY-MM-DD strings (UTC arithmetic: no time zone surprises). */

const DAY_MS = 86_400_000;
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string =>
  fromMs(toMs(date) + days * DAY_MS);

/** Inclusive list of dates. */
export const dateRange = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) out.push(date);
  return out;
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1;

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Adds months keeping the day, clamped to the month length (Mar 31 − 1 month = Feb 28). */
export const addMonths = (date: string, months: number): string => {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const isFirstOfMonth = (date: string) => date.endsWith("-01");
const isLastOfMonth = (date: string) => addDays(date, 1).endsWith("-01");

/** Number of whole calendar months in the range, or null if it is not whole months. */
export const wholeMonths = ({ from, to }: DateRange): number | null => {
  if (!isFirstOfMonth(from) || !isLastOfMonth(to)) return null;
  const [fy = 0, fm = 0] = from.split("-").map(Number);
  const [ty = 0, tm = 0] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
};

/**
 * Period immediately before `range`: whole calendar months shift by months (Sep → Aug 1–31),
 * any other range shifts by its length in days.
 */
export const previousPeriod = (range: DateRange): DateRange => {
  const months = wholeMonths(range);
  if (months !== null) {
    const from = addMonths(range.from, -months);
    return { from, to: addDays(addMonths(from, months), -1) };
  }
  const length = daysBetween(range.from, range.to);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
};

/** Same dates one year earlier (Feb 29 → Feb 28). */
export const previousYear = (range: DateRange): DateRange => {
  const months = wholeMonths(range);
  if (months !== null) {
    const from = addMonths(range.from, -12);
    return { from, to: addDays(addMonths(from, months), -1) };
  }
  return { from: addMonths(range.from, -12), to: addMonths(range.to, -12) };
};

/** Range used by a comparison (`null` for none/projection, which use the same range). */
export const comparisonRange = (
  range: DateRange,
  comparison: Comparison,
): DateRange | null => {
  switch (comparison.mode) {
    case "previous_period":
      return previousPeriod(range);
    case "previous_year":
      return previousYear(range);
    case "custom":
      return comparison.range;
    case "none":
    case "projection":
      return null;
  }
};

/** Monday (ISO week start) of the week containing `date`. */
export const weekStart = (date: string): string => {
  const weekday = new Date(toMs(date)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
};

/** Bucket key of a date (day/week/month) — matches the SQL buckets. */
export const dayBucket = (
  date: string,
  granularity: Exclude<Granularity, "hour">,
): string => {
  switch (granularity) {
    case "day":
      return date;
    case "week":
      return weekStart(date);
    case "month":
      return `${date.slice(0, 7)}-01`;
  }
};

/**
 * Every bucket of the range, in order. Keys: `YYYY-MM-DD` (day/week/month) or
 * `YYYY-MM-DDTHH:mm` (hour), New York wall clock (CLAUDE.md §13).
 */
export const bucketsOf = (
  { from, to }: DateRange,
  granularity: Granularity,
): string[] => {
  if (granularity === "hour") {
    return dateRange(from, to).flatMap((date) =>
      Array.from(
        { length: 24 },
        (_, h) => `${date}T${String(h).padStart(2, "0")}:00`,
      ),
    );
  }
  const keys: string[] = [];
  for (const date of dateRange(from, to)) {
    const key = dayBucket(date, granularity);
    if (keys.at(-1) !== key) keys.push(key);
  }
  return keys;
};
