import {
  CATEGORICAL_DIMENSIONS,
  COLOR_BY,
  DIMENSION_DEFINITIONS,
  GRANULARITIES,
  type Granularity,
  MAP_LAYERS,
  type MapLayer,
  METRIC_IDS,
  type MetricCategory,
  METRICS,
  SERIES_DIMENSIONS,
  TABLE_DIMENSIONS,
  TRIP_FIELDS,
  TRIP_FIELDS_CATALOG,
  type Unit,
} from "@ny-dashboard/shared";

import type { SelectOption } from "../../components/ui";

const CATEGORY_LABELS: Readonly<Record<MetricCategory, string>> = {
  volume: "Volume",
  financial: "Financeiro",
  operations: "Operação",
  fhvhv: "Apps",
};

export const METRIC_OPTIONS = METRIC_IDS.map((id) => ({
  value: id,
  label: `${METRICS[id].label} (${CATEGORY_LABELS[METRICS[id].category]})`,
}));

export const GRANULARITY_LABELS: Readonly<Record<Granularity, string>> = {
  hour: "Hora",
  day: "Dia",
  week: "Semana",
  month: "Mês",
};
export const GRANULARITY_OPTIONS = GRANULARITIES.map((value) => ({
  value,
  label: GRANULARITY_LABELS[value],
}));

const dimensionOption = <T extends keyof typeof DIMENSION_DEFINITIONS>(
  value: T,
) => ({ value, label: DIMENSION_DEFINITIONS[value].label });

export const SERIES_GROUP_OPTIONS: SelectOption<
  "none" | (typeof SERIES_DIMENSIONS)[number]
>[] = [
  { value: "none", label: "Sem agrupamento" },
  ...SERIES_DIMENSIONS.map(dimensionOption),
];
export const CATEGORICAL_OPTIONS = CATEGORICAL_DIMENSIONS.map(dimensionOption);
export const TABLE_DIMENSION_OPTIONS = TABLE_DIMENSIONS.map(dimensionOption);

export const TRIP_FIELD_OPTIONS = TRIP_FIELDS.map((value) => ({
  value,
  label: TRIP_FIELDS_CATALOG[value].label,
}));

export const COLOR_BY_OPTIONS = COLOR_BY.map(dimensionOption);

export const MAP_LAYER_LABELS: Readonly<Record<MapLayer, string>> = {
  choropleth: "Zonas coloridas pela métrica",
  bubbles: "Bolhas por zona",
  heatmap: "Mapa de calor (amostra)",
  arcs: "Rotas origem → destino (arcos)",
  points: "Pontos da amostra",
  hexagon: "Hexágonos 3D (amostra)",
};
export const MAP_LAYER_OPTIONS = MAP_LAYERS.map((id) => ({
  id,
  label: MAP_LAYER_LABELS[id],
}));

/** Unit next to number inputs (e.g. the KPI target). */
export const UNIT_LABELS: Readonly<Record<Unit, string>> = {
  count: "quantidade",
  usd: "US$",
  percent: "%",
  seconds: "segundos",
  miles: "milhas",
  mph: "mph",
};
