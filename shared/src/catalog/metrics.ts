import type { MetricDirection, MetricId, Service } from "../primitives";

/**
 * Base columns of the aggregated tables (sums and denominators; CLAUDE.md §5.4/§5.6).
 * Must match the ETL (`api/etl/lib/metrics.ts`) and the Prisma models.
 */
export const BASE_COLUMNS = [
  "trips",
  "passengers",
  "passenger_trips",
  "revenue",
  "fare",
  "tips",
  "distance_mi",
  "duration_s",
  "airport_trips",
  "card_trips",
  "cash_trips",
  "cbd_fee",
  "wait_s",
  "wait_trips",
  "driver_pay",
  "shared_trips",
] as const;
export type BaseColumn = (typeof BASE_COLUMNS)[number];
export type BaseSums = Partial<Record<BaseColumn, number | null>>;

export const UNITS = [
  "count",
  "usd",
  "percent",
  "seconds",
  "miles",
  "mph",
] as const;
export type Unit = (typeof UNITS)[number];

export const METRIC_CATEGORIES = [
  "volume",
  "financial",
  "operations",
  "fhvhv",
] as const;
export type MetricCategory = (typeof METRIC_CATEGORIES)[number];

/**
 * value = scale × Σ(numerator columns) ÷ Σ(denominator columns).
 * Without a denominator the metric is a plain sum. Ratios are always computed from sums
 * (never an average of averages).
 */
export interface MetricFormula {
  numerator: readonly BaseColumn[];
  denominator?: readonly BaseColumn[];
  scale?: number;
}

export interface MetricDefinition {
  id: MetricId;
  label: string;
  description: string;
  category: MetricCategory;
  unit: Unit;
  formula: MetricFormula;
  /** Services where the metric exists; for others it is "não se aplica". */
  services: readonly Service[];
  /** Default KPI direction (overridable per KPI). Business/operations perspective. */
  direction: MetricDirection;
  /** lucide-react icon name (kebab-case). */
  icon: string;
  /** Plain sums can be stacked/summed across groups (e.g. stacked bars, totals). */
  additive: boolean;
}

const ALL: readonly Service[] = ["yellow", "green", "fhvhv"];
const TAXI: readonly Service[] = ["yellow", "green"];
const FHVHV: readonly Service[] = ["fhvhv"];

const sum = (column: BaseColumn): MetricFormula => ({ numerator: [column] });
const ratio = (
  numerator: BaseColumn | readonly BaseColumn[],
  denominator: BaseColumn | readonly BaseColumn[],
  scale = 1,
): MetricFormula => ({
  numerator: typeof numerator === "string" ? [numerator] : numerator,
  denominator: typeof denominator === "string" ? [denominator] : denominator,
  scale,
});

const definitions: Omit<MetricDefinition, "additive">[] = [
  // ── Volume
  {
    id: "trips",
    label: "Corridas",
    description: "Número de corridas",
    category: "volume",
    unit: "count",
    formula: sum("trips"),
    services: ALL,
    direction: "higher_is_better",
    icon: "car-taxi-front",
  },
  {
    id: "passengers",
    label: "Passageiros",
    description: "Passageiros informados pelo taxímetro",
    category: "volume",
    unit: "count",
    formula: sum("passengers"),
    services: TAXI,
    direction: "higher_is_better",
    icon: "users",
  },
  // ── Financial
  {
    id: "revenue",
    label: "Receita",
    description:
      "Total pago pelos passageiros (tarifa, taxas, pedágios e gorjetas)",
    category: "financial",
    unit: "usd",
    formula: sum("revenue"),
    services: ALL,
    direction: "higher_is_better",
    icon: "banknote",
  },
  {
    id: "avg_fare",
    label: "Tarifa média",
    description: "Tarifa base média por corrida",
    category: "financial",
    unit: "usd",
    formula: ratio("fare", "trips"),
    services: ALL,
    direction: "higher_is_better",
    icon: "receipt",
  },
  {
    id: "avg_tip",
    label: "Gorjeta média",
    description:
      "Gorjeta média por corrida (no táxi, só gorjetas no cartão são registradas)",
    category: "financial",
    unit: "usd",
    formula: ratio("tips", "trips"),
    services: ALL,
    direction: "higher_is_better",
    icon: "hand-coins",
  },
  {
    id: "tip_pct",
    label: "% de gorjeta",
    description: "Gorjetas em relação à tarifa base",
    category: "financial",
    unit: "percent",
    formula: ratio("tips", "fare", 100),
    services: ALL,
    direction: "higher_is_better",
    icon: "percent",
  },
  {
    id: "revenue_per_mile",
    label: "Receita por milha",
    description: "Receita dividida pela distância percorrida",
    category: "financial",
    unit: "usd",
    formula: ratio("revenue", "distance_mi"),
    services: ALL,
    direction: "higher_is_better",
    icon: "route",
  },
  {
    id: "cbd_fee",
    label: "Taxa de congestionamento",
    description:
      "Taxa de congestionamento (CBD) arrecadada, existente desde jan/2025",
    category: "financial",
    unit: "usd",
    formula: sum("cbd_fee"),
    services: ALL,
    direction: "higher_is_better",
    icon: "traffic-cone",
  },
  // ── Operations
  {
    id: "avg_distance",
    label: "Distância média",
    description: "Distância média por corrida",
    category: "operations",
    unit: "miles",
    formula: ratio("distance_mi", "trips"),
    services: ALL,
    direction: "higher_is_better",
    icon: "ruler",
  },
  {
    id: "avg_duration",
    label: "Duração média",
    description: "Duração média por corrida",
    category: "operations",
    unit: "seconds",
    formula: ratio("duration_s", "trips"),
    services: ALL,
    direction: "lower_is_better",
    icon: "timer",
  },
  {
    id: "avg_speed",
    label: "Velocidade média",
    description: "Distância total ÷ tempo total em corrida",
    category: "operations",
    unit: "mph",
    formula: ratio("distance_mi", "duration_s", 3600),
    services: ALL,
    direction: "higher_is_better",
    icon: "gauge",
  },
  {
    id: "airport_pct",
    label: "% aeroporto",
    description: "Corridas com embarque ou desembarque em JFK, LGA ou EWR",
    category: "operations",
    unit: "percent",
    formula: ratio("airport_trips", "trips", 100),
    services: ALL,
    direction: "higher_is_better",
    icon: "plane",
  },
  {
    id: "card_pct",
    label: "% cartão",
    description: "Corridas pagas com cartão ÷ (cartão + dinheiro)",
    category: "operations",
    unit: "percent",
    formula: ratio("card_trips", ["card_trips", "cash_trips"], 100),
    services: TAXI,
    direction: "higher_is_better",
    icon: "credit-card",
  },
  {
    id: "cash_pct",
    label: "% dinheiro",
    description: "Corridas pagas em dinheiro ÷ (cartão + dinheiro)",
    category: "operations",
    unit: "percent",
    formula: ratio("cash_trips", ["card_trips", "cash_trips"], 100),
    services: TAXI,
    direction: "lower_is_better",
    icon: "wallet",
  },
  // ── FHVHV
  {
    id: "avg_wait",
    label: "Espera média",
    description: "Tempo médio entre o pedido no app e o embarque",
    category: "fhvhv",
    unit: "seconds",
    formula: ratio("wait_s", "wait_trips"),
    services: FHVHV,
    direction: "lower_is_better",
    icon: "hourglass",
  },
  {
    id: "driver_pay_pct",
    label: "% para o motorista",
    description: "Pagamento ao motorista em relação à tarifa base",
    category: "fhvhv",
    unit: "percent",
    formula: ratio("driver_pay", "fare", 100),
    services: FHVHV,
    direction: "higher_is_better",
    icon: "badge-dollar-sign",
  },
  {
    id: "shared_pct",
    label: "% compartilhadas",
    description: "Corridas compartilhadas com outro passageiro",
    category: "fhvhv",
    unit: "percent",
    formula: ratio("shared_trips", "trips", 100),
    services: FHVHV,
    direction: "higher_is_better",
    icon: "users-round",
  },
];

export const METRICS: Readonly<Record<MetricId, MetricDefinition>> =
  Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      { ...definition, additive: definition.formula.denominator === undefined },
    ]),
  ) as Record<MetricId, MetricDefinition>;

export const getMetric = (id: MetricId): MetricDefinition => METRICS[id];

/** Base columns needed to compute a metric. */
export const metricColumns = (id: MetricId): BaseColumn[] => {
  const { numerator, denominator = [] } = METRICS[id].formula;
  return [...new Set([...numerator, ...denominator])];
};

/** True if at least one of the selected services has the metric (empty selection = all). */
export const isMetricApplicable = (
  id: MetricId,
  services: readonly Service[],
): boolean => {
  const selected = services.length === 0 ? ALL : services;
  return selected.some((service) => METRICS[id].services.includes(service));
};

/** Selected services restricted to those where the metric exists (empty selection = all). */
export const applicableServices = (
  id: MetricId,
  services: readonly Service[],
): Service[] => {
  const selected = services.length === 0 ? ALL : services;
  return selected.filter((service) => METRICS[id].services.includes(service));
};

const total = (
  sums: BaseSums,
  columns: readonly BaseColumn[],
): number | null => {
  let result: number | null = null;
  for (const column of columns) {
    const value = sums[column];
    if (value !== null && value !== undefined) result = (result ?? 0) + value;
  }
  return result;
};

/** Computes a metric from base sums; `null` when there is no data or the denominator is 0. */
export const computeMetric = (id: MetricId, sums: BaseSums): number | null => {
  const { numerator, denominator, scale = 1 } = METRICS[id].formula;
  const top = total(sums, numerator);
  if (top === null) return null;
  if (!denominator) return top;
  const bottom = total(sums, denominator);
  if (bottom === null || bottom === 0) return null;
  return (scale * top) / bottom;
};
