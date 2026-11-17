import type { Borough, Company, Dimension, Service } from "../primitives";

export const SERVICE_LABELS: Readonly<Record<Service, string>> = {
  yellow: "Yellow Taxi",
  green: "Green Taxi",
  fhvhv: "Apps (Uber/Lyft)",
};

export const COMPANY_LABELS: Readonly<Record<Company, string>> = {
  yellow: "Yellow",
  green: "Green",
  uber: "Uber",
  lyft: "Lyft",
  other: "Outras",
};

/** Service each company belongs to (Yellow/Green are their own company; CLAUDE.md §5.2). */
export const COMPANY_SERVICE: Readonly<Record<Company, Service>> = {
  yellow: "yellow",
  green: "green",
  uber: "fhvhv",
  lyft: "fhvhv",
  other: "fhvhv",
};

export const BOROUGH_LABELS: Readonly<Record<Borough, string>> = {
  manhattan: "Manhattan",
  brooklyn: "Brooklyn",
  queens: "Queens",
  bronx: "Bronx",
  staten_island: "Staten Island",
  ewr: "Newark (EWR)",
  unknown: "Desconhecido",
};

/** ISO day of week: 1 = Monday … 7 = Sunday. */
export const DAY_OF_WEEK_LABELS: Readonly<Record<number, string>> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

export const hourOfDayLabel = (hour: number): string => `${String(hour)}h`;

export interface DimensionDefinition {
  id: Dimension;
  label: string;
  icon: string;
}

export const DIMENSION_DEFINITIONS: Readonly<
  Record<Dimension, DimensionDefinition>
> = {
  service: { id: "service", label: "Serviço", icon: "car-taxi-front" },
  company: { id: "company", label: "Empresa", icon: "building-2" },
  borough: { id: "borough", label: "Distrito", icon: "map" },
  zone: { id: "zone", label: "Zona", icon: "map-pin" },
  hour_of_day: { id: "hour_of_day", label: "Hora do dia", icon: "clock" },
  day_of_week: {
    id: "day_of_week",
    label: "Dia da semana",
    icon: "calendar-days",
  },
  route: { id: "route", label: "Rota", icon: "route" },
};

const lookup = (
  labels: Readonly<Record<string, string>>,
  key: string,
): string => (labels as Partial<Record<string, string>>)[key] ?? key;

/**
 * Display label of a dimension value. Zones/routes need the zone lookup (served by the API), so
 * they are labeled by the caller; here they fall back to the raw key.
 */
export const dimensionValueLabel = (
  dimension: Dimension,
  key: string,
): string => {
  switch (dimension) {
    case "service":
      return lookup(SERVICE_LABELS, key);
    case "company":
      return lookup(COMPANY_LABELS, key);
    case "borough":
      return lookup(BOROUGH_LABELS, key);
    case "hour_of_day":
      return hourOfDayLabel(Number(key));
    case "day_of_week":
      return lookup(DAY_OF_WEEK_LABELS, key);
    case "zone":
    case "route":
      return key;
  }
};
