import type { DashboardState, GridItem, Layouts } from "../dashboard";
import type { GlobalFilters } from "../filters";
import type { WidgetConfig } from "../widgets";
import { DATA_COVERAGE } from "./coverage";

/** Default filters: last month with data compared to the previous month (CLAUDE.md §6.2). */
export const DEFAULT_GLOBAL_FILTERS: GlobalFilters = {
  period: DATA_COVERAGE.lastMonth,
  comparison: { mode: "previous_period" },
  services: [],
  companies: [],
  boroughs: [],
};

const comparisonOnly = {
  comparison: { enabled: true, neutralBandPct: 2 },
  target: null,
};

/**
 * Widgets of the default dashboard, telling the story of September 2026: KPIs, expected vs
 * actual, month-over-month, market share, when and where trips happen, and the trip sample.
 */
const WIDGETS: WidgetConfig[] = [
  // ── KPIs
  {
    id: "kpi-trips",
    type: "kpi",
    title: "Corridas",
    metric: "trips",
    sparkline: true,
    evaluation: comparisonOnly,
  },
  {
    id: "kpi-revenue",
    type: "kpi",
    title: "Receita",
    metric: "revenue",
    sparkline: true,
    evaluation: {
      comparison: { enabled: true, neutralBandPct: 2 },
      target: { value: 900_000_000, warningBandPct: 5 },
    },
  },
  {
    id: "kpi-avg-fare",
    type: "kpi",
    title: "Tarifa média",
    metric: "avg_fare",
    sparkline: true,
    evaluation: comparisonOnly,
  },
  {
    id: "kpi-tip-pct",
    type: "kpi",
    title: "% de gorjeta",
    metric: "tip_pct",
    sparkline: true,
    evaluation: comparisonOnly,
  },
  {
    id: "kpi-avg-wait",
    type: "kpi",
    title: "Espera no app",
    metric: "avg_wait",
    sparkline: true,
    evaluation: {
      comparison: { enabled: true, neutralBandPct: 2 },
      target: { value: 300, warningBandPct: 10 },
    },
  },
  {
    id: "kpi-avg-speed",
    type: "kpi",
    title: "Velocidade média",
    metric: "avg_speed",
    sparkline: true,
    evaluation: comparisonOnly,
  },
  // ── Expected vs actual, month over month
  {
    id: "line-trips-projection",
    type: "line",
    title: "Corridas por dia: real × projeção",
    metric: "trips",
    granularity: "day",
    showProjection: true,
    filters: { comparison: { mode: "projection" } },
  },
  {
    id: "doughnut-company-share",
    type: "doughnut",
    title: "Participação por empresa",
    metric: "trips",
    dimension: "company",
  },
  {
    id: "area-revenue-mom",
    type: "area",
    title: "Receita diária: mês atual × anterior",
    metric: "revenue",
    granularity: "day",
    showProjection: false,
  },
  {
    id: "radar-hour-of-day",
    type: "radar",
    title: "Corridas por hora do dia",
    metric: "trips",
    dimension: "hour_of_day",
  },
  // ── Where
  {
    id: "map-zones",
    type: "map",
    title: "Corridas por zona de embarque",
    metric: "trips",
    layers: ["choropleth"],
    colorBy: "service",
  },
  {
    id: "table-top-zones",
    type: "table",
    title: "Zonas com mais corridas",
    dimension: "zone",
    columns: ["trips", "revenue", "avg_fare"],
    sortBy: "trips",
    sortDir: "desc",
    limit: 15,
  },
  {
    id: "map-routes",
    type: "map",
    title: "Rotas mais frequentes",
    metric: "trips",
    layers: ["arcs"],
    colorBy: "service",
  },
  // ── Trip sample (filtered to JFK pickups so the default page stays light; CLAUDE.md §8)
  {
    id: "scatter-jfk",
    type: "scatter",
    title: "Distância × tarifa: embarques no JFK (amostra)",
    x: "distance",
    y: "fare",
    colorBy: "company",
    filters: { period: DATA_COVERAGE.lastMonth, zones: [132] },
  },
];

const at = (
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
): GridItem => ({ i, x, y, w, h });

/** Desktop: 12 columns. */
const DESKTOP: GridItem[] = [
  at("kpi-trips", 0, 0, 2, 3),
  at("kpi-revenue", 2, 0, 2, 3),
  at("kpi-avg-fare", 4, 0, 2, 3),
  at("kpi-tip-pct", 6, 0, 2, 3),
  at("kpi-avg-wait", 8, 0, 2, 3),
  at("kpi-avg-speed", 10, 0, 2, 3),
  at("line-trips-projection", 0, 3, 8, 8),
  at("doughnut-company-share", 8, 3, 4, 8),
  at("area-revenue-mom", 0, 11, 8, 8),
  at("radar-hour-of-day", 8, 11, 4, 8),
  at("map-zones", 0, 19, 8, 12),
  at("table-top-zones", 8, 19, 4, 12),
  at("map-routes", 0, 31, 6, 10),
  at("scatter-jfk", 6, 31, 6, 10),
];

/** Mobile: 2 columns; KPIs side by side, everything else full width. */
const MOBILE: GridItem[] = [
  at("kpi-trips", 0, 0, 1, 3),
  at("kpi-revenue", 1, 0, 1, 3),
  at("kpi-avg-fare", 0, 3, 1, 3),
  at("kpi-tip-pct", 1, 3, 1, 3),
  at("kpi-avg-wait", 0, 6, 1, 3),
  at("kpi-avg-speed", 1, 6, 1, 3),
  at("line-trips-projection", 0, 9, 2, 7),
  at("doughnut-company-share", 0, 16, 2, 7),
  at("area-revenue-mom", 0, 23, 2, 7),
  at("radar-hour-of-day", 0, 30, 2, 7),
  at("map-zones", 0, 37, 2, 9),
  at("table-top-zones", 0, 46, 2, 9),
  at("map-routes", 0, 55, 2, 9),
  at("scatter-jfk", 0, 64, 2, 8),
];

/**
 * Returns a fresh copy of the default dashboard (used by the seed for the demo user, by
 * visitors and by "voltar ao padrão"; CLAUDE.md §6.4).
 */
export const createDefaultDashboard = (): DashboardState =>
  structuredClone({
    version: 1,
    filters: DEFAULT_GLOBAL_FILTERS,
    widgets: WIDGETS,
    layouts: { desktop: DESKTOP, mobile: MOBILE } satisfies Layouts,
  });
