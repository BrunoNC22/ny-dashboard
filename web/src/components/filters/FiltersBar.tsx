import { type Company, type Service } from "@ny-dashboard/shared";
import { Building2, CarTaxiFront, FilterX, MapPinned } from "lucide-react";

import { useDashboardStore } from "../../stores/dashboardStore";
import { Button } from "../ui";
import { ComparisonFilter } from "./ComparisonFilter";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { PeriodFilter } from "./PeriodFilter";
import { companyFilterEnabled, useFilterOptions } from "./useFilterOptions";

/**
 * Global filters (CLAUDE.md §6.2) in one wrapping row above the widgets: period, comparison,
 * service, company and borough. Every change goes through the store (undoable, autosaved).
 */
export function FiltersBar() {
  const filters = useDashboardStore((s) => s.state.filters);
  const setFilters = useDashboardStore((s) => s.setFilters);
  const options = useFilterOptions();

  const serviceSet = filters.services.length
    ? filters.services
    : options.services.map((s) => s.id);
  const companyOptions = options.companies.filter((c) =>
    serviceSet.includes(c.service),
  );
  const companiesEnabled = companyFilterEnabled(filters.services);
  const hasDimensionFilters =
    filters.services.length > 0 ||
    filters.companies.length > 0 ||
    filters.boroughs.length > 0;

  const changeServices = (services: Service[]) => {
    // Drop companies that no longer belong to a selected service.
    const allowed = new Set<Company>(
      options.companies
        .filter((c) => services.length === 0 || services.includes(c.service))
        .map((c) => c.id),
    );
    const companies = companyFilterEnabled(services)
      ? filters.companies.filter((c) => allowed.has(c))
      : [];
    setFilters({ services, companies });
  };

  return (
    <div
      role="toolbar"
      aria-label="Filtros globais"
      className="flex flex-wrap items-center gap-2"
    >
      <PeriodFilter
        value={filters.period}
        coverage={options.coverage}
        onChange={(period) => {
          setFilters({ period });
        }}
      />
      <ComparisonFilter
        value={filters.comparison}
        period={filters.period}
        coverage={options.coverage}
        projection={
          options.projectionFrom && options.projectionUntil
            ? { from: options.projectionFrom, to: options.projectionUntil }
            : null
        }
        onChange={(comparison) => {
          setFilters({ comparison });
        }}
      />
      <MultiSelectFilter
        name="Serviço"
        icon={<CarTaxiFront size={16} />}
        options={options.services}
        value={filters.services}
        onChange={changeServices}
      />
      <MultiSelectFilter
        name="Empresa"
        icon={<Building2 size={16} />}
        options={companyOptions}
        value={filters.companies}
        disabled={!companiesEnabled}
        hint="Uber e Lyft são do serviço de apps; Yellow e Green são o próprio serviço."
        onChange={(companies) => {
          setFilters({ companies });
        }}
      />
      <MultiSelectFilter
        name="Distrito"
        icon={<MapPinned size={16} />}
        options={options.boroughs}
        value={filters.boroughs}
        onChange={(boroughs) => {
          setFilters({ boroughs });
        }}
      />
      {hasDimensionFilters && (
        <Button
          size="sm"
          variant="ghost"
          icon={<FilterX size={14} />}
          onClick={() => {
            setFilters({ services: [], companies: [], boroughs: [] });
          }}
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
