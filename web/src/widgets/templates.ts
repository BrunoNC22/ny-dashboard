import {
  type Breakpoint,
  BREAKPOINTS,
  DATA_COVERAGE,
  type WidgetConfig,
} from "@ny-dashboard/shared";

import { newWidgetId } from "../stores/dashboardStore";
import { WIDGET_REGISTRY } from "./registry";
import type { WidgetGroup } from "./types";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** A widget config without id: the gallery assigns one on insert. */
export type WidgetDraft = DistributiveOmit<WidgetConfig, "id">;

export interface WidgetTemplate {
  id: string;
  group: WidgetGroup;
  name: string;
  description: string;
  /** Loads a lot of data on purpose (CLAUDE.md §8). */
  heavy?: boolean;
  draft: WidgetDraft;
}

export const GROUP_LABELS: Readonly<Record<WidgetGroup, string>> = {
  kpi: "KPIs",
  series: "Séries temporais",
  composition: "Composição",
  distribution: "Distribuição",
  map: "Mapas",
  table: "Tabelas",
};

const comparisonOnly = {
  comparison: { enabled: true, neutralBandPct: 2 },
  target: null,
};

/** The sample covers only its month (CLAUDE.md §5.6). */
const sampleMonth = { period: DATA_COVERAGE.lastMonth };

const kpi = (
  id: string,
  name: string,
  metric: Extract<WidgetDraft, { type: "kpi" }>["metric"],
  description: string,
): WidgetTemplate => ({
  id,
  group: "kpi",
  name,
  description,
  draft: {
    type: "kpi",
    title: name,
    metric,
    sparkline: true,
    evaluation: comparisonOnly,
  },
});

/** Ready-made widgets (CLAUDE.md §6.1): pick one, then customize it in the editor. */
export const WIDGET_TEMPLATES: readonly WidgetTemplate[] = [
  // ── KPIs
  kpi(
    "kpi-trips",
    "Corridas",
    "trips",
    "Total de corridas no período, com variação.",
  ),
  kpi("kpi-revenue", "Receita", "revenue", "Total pago pelos passageiros."),
  kpi("kpi-avg-fare", "Tarifa média", "avg_fare", "Tarifa média por corrida."),
  kpi("kpi-tip-pct", "% de gorjeta", "tip_pct", "Gorjetas sobre a tarifa."),
  kpi(
    "kpi-avg-wait",
    "Espera no app",
    "avg_wait",
    "Tempo médio entre pedir e embarcar (Uber/Lyft).",
  ),
  kpi(
    "kpi-avg-speed",
    "Velocidade média",
    "avg_speed",
    "Distância total ÷ tempo total.",
  ),
  kpi(
    "kpi-airport",
    "% de aeroporto",
    "airport_pct",
    "Corridas com embarque ou desembarque em aeroporto.",
  ),
  kpi(
    "kpi-cbd",
    "Taxa de congestionamento",
    "cbd_fee",
    "Taxa CBD arrecadada (desde jan/2025).",
  ),
  kpi(
    "kpi-driver-pay",
    "% para o motorista",
    "driver_pay_pct",
    "Parte da tarifa que vai para o motorista (apps).",
  ),
  // ── Time series
  {
    id: "line-trips-projection",
    group: "series",
    name: "Corridas por dia: real × projeção",
    description: "Linha diária com a projeção Holt-Winters sobreposta.",
    draft: {
      type: "line",
      title: "Corridas por dia: real × projeção",
      metric: "trips",
      granularity: "day",
      showProjection: true,
      filters: { comparison: { mode: "projection" } },
    },
  },
  {
    id: "area-revenue-mom",
    group: "series",
    name: "Receita diária: mês atual × anterior",
    description: "Área com a série comparada tracejada.",
    draft: {
      type: "area",
      title: "Receita diária: mês atual × anterior",
      metric: "revenue",
      granularity: "day",
      showProjection: false,
    },
  },
  {
    id: "line-speed-by-service",
    group: "series",
    name: "Velocidade média por serviço",
    description: "Uma linha por serviço, dia a dia.",
    draft: {
      type: "line",
      title: "Velocidade média por serviço",
      metric: "avg_speed",
      granularity: "day",
      groupBy: "service",
      showProjection: false,
    },
  },
  {
    id: "stacked-trips-company",
    group: "series",
    name: "Corridas por semana e empresa",
    description: "Barras empilhadas por empresa, 24 meses.",
    draft: {
      type: "stacked_bar",
      title: "Corridas por semana e empresa",
      metric: "trips",
      granularity: "week",
      groupBy: "company",
      showProjection: false,
      filters: { period: DATA_COVERAGE.period, comparison: { mode: "none" } },
    },
  },
  {
    id: "bar-revenue-month",
    group: "series",
    name: "Receita por mês",
    description: "Barras mensais nos 24 meses de dados.",
    draft: {
      type: "bar",
      title: "Receita por mês",
      metric: "revenue",
      granularity: "month",
      showProjection: false,
      filters: { period: DATA_COVERAGE.period, comparison: { mode: "none" } },
    },
  },
  {
    id: "line-trips-hourly-24m",
    group: "series",
    name: "Corridas por hora: 24 meses",
    description:
      "~17,5 mil pontos por série: mostra a decimação (LTTB) do Chart.js.",
    heavy: true,
    draft: {
      type: "line",
      title: "Corridas por hora: 24 meses",
      metric: "trips",
      granularity: "hour",
      showProjection: false,
      filters: { period: DATA_COVERAGE.period, comparison: { mode: "none" } },
    },
  },
  // ── Composition
  {
    id: "doughnut-company",
    group: "composition",
    name: "Participação por empresa",
    description: "Rosca com Uber, Lyft, Yellow e Green.",
    draft: {
      type: "doughnut",
      title: "Participação por empresa",
      metric: "trips",
      dimension: "company",
    },
  },
  {
    id: "pie-borough",
    group: "composition",
    name: "Receita por distrito",
    description: "Pizza da receita por distrito de embarque.",
    draft: {
      type: "pie",
      title: "Receita por distrito",
      metric: "revenue",
      dimension: "borough",
    },
  },
  {
    id: "polar-service",
    group: "composition",
    name: "Gorjeta média por serviço",
    description: "Área polar comparando os serviços.",
    draft: {
      type: "polar_area",
      title: "Gorjeta média por serviço",
      metric: "avg_tip",
      dimension: "service",
    },
  },
  {
    id: "ranking-zones",
    group: "composition",
    name: "Ranking de zonas",
    description: "Barras horizontais com as 10 zonas com mais corridas.",
    draft: {
      type: "bar_horizontal",
      title: "Zonas com mais corridas",
      metric: "trips",
      dimension: "zone",
      topN: 10,
    },
  },
  // ── Distribution
  {
    id: "radar-hour",
    group: "distribution",
    name: "Corridas por hora do dia",
    description: "Radar com as 24 horas.",
    draft: {
      type: "radar",
      title: "Corridas por hora do dia",
      metric: "trips",
      dimension: "hour_of_day",
    },
  },
  {
    id: "radar-weekday",
    group: "distribution",
    name: "Tarifa média por dia da semana",
    description: "Radar de segunda a domingo.",
    draft: {
      type: "radar",
      title: "Tarifa média por dia da semana",
      metric: "avg_fare",
      dimension: "day_of_week",
    },
  },
  {
    id: "scatter-jfk",
    group: "distribution",
    name: "Distância × tarifa: JFK",
    description: "Amostra de corridas com embarque no JFK, por empresa.",
    draft: {
      type: "scatter",
      title: "Distância × tarifa: embarques no JFK (amostra)",
      x: "distance",
      y: "fare",
      colorBy: "company",
      filters: { ...sampleMonth, zones: [132] },
    },
  },
  {
    id: "bubble-tips",
    group: "distribution",
    name: "Distância × tarifa × gorjeta: LaGuardia",
    description: "Bolhas com raio pela gorjeta (amostra, LaGuardia).",
    draft: {
      type: "bubble",
      title: "Distância × tarifa × gorjeta: LaGuardia (amostra)",
      x: "distance",
      y: "fare",
      r: "tips",
      colorBy: "service",
      filters: { ...sampleMonth, zones: [138] },
    },
  },
  {
    id: "scatter-all",
    group: "distribution",
    name: "Distância × tarifa: amostra completa",
    description:
      "1 milhão de pontos: vai deixar o Chart.js lento de propósito.",
    heavy: true,
    draft: {
      type: "scatter",
      title: "Distância × tarifa: amostra completa",
      x: "distance",
      y: "fare",
      colorBy: "service",
      filters: sampleMonth,
    },
  },
  // ── Maps
  {
    id: "map-choropleth",
    group: "map",
    name: "Zonas coloridas por métrica",
    description: "Coroplético; com comparação, mostra a variação %.",
    draft: {
      type: "map",
      title: "Corridas por zona de embarque",
      metric: "trips",
      layers: ["choropleth"],
      colorBy: "service",
    },
  },
  {
    id: "map-bubbles",
    group: "map",
    name: "Bolhas por zona",
    description: "Uma bolha por zona, com área proporcional à métrica.",
    draft: {
      type: "map",
      title: "Receita por zona",
      metric: "revenue",
      layers: ["bubbles"],
      colorBy: "service",
    },
  },
  {
    id: "map-arcs",
    group: "map",
    name: "Rotas mais frequentes",
    description: "Arcos de origem → destino.",
    draft: {
      type: "map",
      title: "Rotas mais frequentes",
      metric: "trips",
      layers: ["arcs"],
      colorBy: "service",
    },
  },
  {
    id: "map-heatmap",
    group: "map",
    name: "Mapa de calor de embarques",
    description: "Densidade da amostra de corridas (posição aproximada).",
    draft: {
      type: "map",
      title: "Mapa de calor de embarques",
      metric: "trips",
      layers: ["heatmap"],
      colorBy: "service",
      filters: sampleMonth,
    },
  },
  {
    id: "map-points",
    group: "map",
    name: "Pontos da amostra",
    description: "Até 1 milhão de pontos na GPU, um ícone por empresa.",
    heavy: true,
    draft: {
      type: "map",
      title: "Embarques da amostra por empresa",
      metric: "trips",
      layers: ["points"],
      colorBy: "company",
      filters: sampleMonth,
    },
  },
  {
    id: "map-hexagon",
    group: "map",
    name: "Hexágonos 3D",
    description: "Colunas hexagonais com a contagem da amostra.",
    draft: {
      type: "map",
      title: "Embarques em hexágonos 3D",
      metric: "trips",
      layers: ["hexagon"],
      colorBy: "service",
      filters: sampleMonth,
    },
  },
  // ── Tables
  {
    id: "table-zones",
    group: "table",
    name: "Zonas com mais corridas",
    description: "Corridas, receita e tarifa média por zona.",
    draft: {
      type: "table",
      title: "Zonas com mais corridas",
      dimension: "zone",
      columns: ["trips", "revenue", "avg_fare"],
      sortBy: "trips",
      sortDir: "desc",
      limit: 15,
    },
  },
  {
    id: "table-routes",
    group: "table",
    name: "Rotas mais frequentes",
    description: "Origem → destino, com receita e distância média.",
    draft: {
      type: "table",
      title: "Rotas mais frequentes",
      dimension: "route",
      columns: ["trips", "revenue", "avg_distance"],
      sortBy: "trips",
      sortDir: "desc",
      limit: 15,
    },
  },
  {
    id: "table-companies",
    group: "table",
    name: "Comparativo de empresas",
    description: "Tarifa, gorjeta e velocidade por empresa.",
    draft: {
      type: "table",
      title: "Comparativo de empresas",
      dimension: "company",
      columns: ["trips", "avg_fare", "tip_pct", "avg_speed"],
      sortBy: "trips",
      sortDir: "desc",
      limit: 10,
    },
  },
];

/** Case- and accent-insensitive search on name and description. */
export const searchTemplates = (
  templates: readonly WidgetTemplate[],
  query: string,
): WidgetTemplate[] => {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return templates.filter((template) => {
    const haystack = normalize(`${template.name} ${template.description}`);
    return terms.every((term) => haystack.includes(term));
  });
};

/** Builds the widget (new id) and its default size per breakpoint from the registry. */
export const instantiateTemplate = (template: WidgetTemplate) => {
  const widget = {
    ...structuredClone(template.draft),
    id: newWidgetId(template.draft.type),
  };
  const { sizes } = WIDGET_REGISTRY[widget.type];
  const layoutSizes = Object.fromEntries(
    BREAKPOINTS.map((bp) => [bp, { w: sizes[bp].w, h: sizes[bp].h }]),
  ) as Record<Breakpoint, { w: number; h: number }>;
  return { widget, sizes: layoutSizes };
};
