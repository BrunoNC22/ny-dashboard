import type {
  BreakdownRequest,
  BreakdownResponse,
  MetricId,
  WidgetConfigOf,
} from "@ny-dashboard/shared";

import type { EffectiveFilters } from "../resolveFilters";

export type TableWidget = WidgetConfigOf<"table">;

/**
 * One breakdown per column: the sorting column brings the ranked top N; the others bring every
 * row and are joined by key. (A top N of the other columns would rank by *their* value — the
 * longest routes for "distância média" — and miss the ranked keys. All routes of a month are
 * ~5.5k rows, ~200 KB gzipped, ~0.25 s.)
 */
export const toTableRequests = (
  widget: TableWidget,
  filters: EffectiveFilters,
): BreakdownRequest[] => {
  const { comparison, ...queryFilters } = filters;
  return widget.columns.map((metric) => ({
    metric,
    dimensions: [widget.dimension],
    filters: queryFilters,
    comparison,
    sort: metric === widget.sortBy ? widget.sortDir : "desc",
    sortBy: "value",
    ...(metric === widget.sortBy ? { topN: widget.limit } : {}),
  }));
};

export interface TableCell {
  value: number | null;
  deltaPct: number | null;
}

export interface TableRow {
  key: string;
  label: string;
  cells: Partial<Record<MetricId, TableCell>>;
}

/** Joins the per-column responses on the ranked rows of the sorting column. */
export const joinColumns = (
  widget: TableWidget,
  responses: readonly (BreakdownResponse | undefined)[],
): TableRow[] => {
  const sortIndex = widget.columns.indexOf(widget.sortBy);
  const ranked = responses[sortIndex];
  if (!ranked) return [];
  const lookups = widget.columns.map((metric, i) => {
    const map = new Map<string, TableCell>();
    responses[i]?.rows.forEach((row) => {
      map.set(row.keys.join("|"), { value: row.value, deltaPct: row.deltaPct });
    });
    return [metric, map] as const;
  });
  return ranked.rows.map((row) => {
    const key = row.keys.join("|");
    const cells: Partial<Record<MetricId, TableCell>> = {};
    for (const [metric, map] of lookups) {
      const cell = map.get(key);
      if (cell) cells[metric] = cell;
    }
    return { key, label: row.labels.join(" · "), cells };
  });
};

/** Largest absolute value of a column (mini-bar scale). */
export const columnMax = (rows: readonly TableRow[], metric: MetricId) =>
  rows.reduce(
    (max, row) => Math.max(max, Math.abs(row.cells[metric]?.value ?? 0)),
    0,
  );

/** Clicking a header: same column flips the direction, another column sorts descending. */
export const nextSort = (
  widget: TableWidget,
  metric: MetricId,
): Pick<TableWidget, "sortBy" | "sortDir"> =>
  metric === widget.sortBy
    ? { sortBy: metric, sortDir: widget.sortDir === "desc" ? "asc" : "desc" }
    : { sortBy: metric, sortDir: "desc" };
