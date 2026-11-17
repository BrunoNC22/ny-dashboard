import type {
  Comparison,
  GlobalFilters,
  QueryFilters,
  WidgetFilterOverrides,
} from "@ny-dashboard/shared";

/** Filters a widget actually uses: the global ones, field by field replaced by its overrides. */
export interface EffectiveFilters extends QueryFilters {
  comparison: Comparison;
}

export const resolveWidgetFilters = (
  global: GlobalFilters,
  overrides: WidgetFilterOverrides | undefined,
): EffectiveFilters => ({
  period: overrides?.period ?? global.period,
  comparison: overrides?.comparison ?? global.comparison,
  services: overrides?.services ?? global.services,
  companies: overrides?.companies ?? global.companies,
  boroughs: overrides?.boroughs ?? global.boroughs,
  zones: overrides?.zones ?? [],
});

const OVERRIDE_LABELS: Readonly<Record<keyof WidgetFilterOverrides, string>> = {
  period: "período",
  comparison: "comparação",
  services: "serviço",
  companies: "empresa",
  boroughs: "distrito",
  zones: "zona",
};

/** pt-BR names of the filters this widget overrides (for the frame badge). */
export const overriddenFilterLabels = (
  overrides: WidgetFilterOverrides | undefined,
): string[] =>
  overrides
    ? (Object.keys(OVERRIDE_LABELS) as (keyof WidgetFilterOverrides)[])
        .filter((key) => overrides[key] !== undefined)
        .map((key) => OVERRIDE_LABELS[key])
    : [];
