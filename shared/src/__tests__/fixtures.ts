import type {
  DashboardState,
  GlobalFilters,
  QueryFilters,
  WidgetConfig,
} from "../index";

export const globalFilters: GlobalFilters = {
  period: { from: "2026-09-01", to: "2026-09-30" },
  comparison: { mode: "previous_period" },
  services: [],
  companies: [],
  boroughs: [],
};

export const queryFilters: QueryFilters = {
  period: { from: "2026-09-01", to: "2026-09-30" },
  services: ["fhvhv"],
  companies: ["uber", "lyft"],
  boroughs: [],
  zones: [],
};

export const kpiWidget: WidgetConfig = {
  id: "kpi-trips",
  type: "kpi",
  title: "Corridas",
  metric: "trips",
  sparkline: true,
  evaluation: {
    comparison: { enabled: true, neutralBandPct: 2 },
    target: null,
  },
};

export const lineWidget: WidgetConfig = {
  id: "line-revenue",
  type: "line",
  title: "Receita diária",
  metric: "revenue",
  granularity: "day",
  showProjection: true,
};

export const validDashboard = (): DashboardState => ({
  version: 1,
  filters: globalFilters,
  widgets: [kpiWidget, lineWidget],
  layouts: {
    desktop: [
      { i: "kpi-trips", x: 0, y: 0, w: 3, h: 2 },
      { i: "line-revenue", x: 3, y: 0, w: 9, h: 4 },
    ],
    mobile: [
      { i: "kpi-trips", x: 0, y: 0, w: 1, h: 2 },
      { i: "line-revenue", x: 0, y: 2, w: 2, h: 4 },
    ],
  },
});
