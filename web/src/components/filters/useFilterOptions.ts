import {
  type Borough,
  BOROUGH_LABELS,
  BOROUGHS,
  COMPANIES,
  type Company,
  COMPANY_LABELS,
  COMPANY_SERVICE,
  DATA_COVERAGE,
  type DateRange,
  type Service,
  SERVICE_LABELS,
  SERVICES,
} from "@ny-dashboard/shared";

import { useMeta } from "../../api/hooks";

export interface Option<T extends string> {
  id: T;
  label: string;
}

export interface FilterOptions {
  /** Days with data. */
  coverage: DateRange;
  /** First day with a backtest projection (null: no projection). */
  projectionFrom: string | null;
  projectionUntil: string | null;
  services: Option<Service>[];
  companies: (Option<Company> & { service: Service })[];
  boroughs: Option<Borough>[];
}

/** Without /api/meta (loading or API down): the shared catalog and the snapshot coverage. */
export const FALLBACK_OPTIONS: FilterOptions = {
  coverage: DATA_COVERAGE.period,
  projectionFrom: null,
  projectionUntil: null,
  services: SERVICES.map((id) => ({ id, label: SERVICE_LABELS[id] })),
  companies: COMPANIES.filter((id) => id !== "other").map((id) => ({
    id,
    label: COMPANY_LABELS[id],
    service: COMPANY_SERVICE[id],
  })),
  boroughs: BOROUGHS.map((id) => ({ id, label: BOROUGH_LABELS[id] })),
};

/** Filter choices and limits, from /api/meta (what the loaded data really has). */
export const useFilterOptions = (): FilterOptions => {
  const meta = useMeta();
  if (!meta.data) return FALLBACK_OPTIONS;
  return {
    coverage: meta.data.period,
    projectionFrom: meta.data.projection.backtestFrom,
    projectionUntil: meta.data.projection.until,
    services: meta.data.services,
    companies: meta.data.companies,
    boroughs: meta.data.boroughs,
  };
};

/** Company filter only makes sense when the app trips (FHVHV) are included. */
export const companyFilterEnabled = (services: readonly Service[]) =>
  services.length === 0 || services.includes("fhvhv");
