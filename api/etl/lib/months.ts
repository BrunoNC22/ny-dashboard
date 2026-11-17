/** Month in `YYYY-MM` format. */
export type Month = `${number}-${number}`;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonth = (value: string): value is Month => MONTH_RE.test(value);

export const parseMonth = (value: string): Month => {
  if (!isMonth(value))
    throw new Error(`Invalid month "${value}" (expected YYYY-MM)`);
  return value;
};

const toIndex = (month: Month): number => {
  const [year, mm] = month.split("-").map(Number);
  return (year ?? 0) * 12 + (mm ?? 1) - 1;
};

const fromIndex = (index: number): Month =>
  `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}` as Month;

/** Inclusive list of months between `from` and `to`. */
export const monthRange = (from: Month, to: Month): Month[] => {
  const start = toIndex(from);
  const end = toIndex(to);
  if (start > end) throw new Error(`--from ${from} is after --to ${to}`);
  return Array.from({ length: end - start + 1 }, (_, i) =>
    fromIndex(start + i),
  );
};

export const nextMonth = (month: Month): Month => fromIndex(toIndex(month) + 1);
