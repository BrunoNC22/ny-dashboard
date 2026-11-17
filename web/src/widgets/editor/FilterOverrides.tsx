import {
  BOROUGH_LABELS,
  type WidgetConfig,
  type WidgetFilterOverrides,
} from "@ny-dashboard/shared";
import { Building2, CarTaxiFront, MapPinned, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useMeta } from "../../api/hooks";
import { ComparisonFilter } from "../../components/filters/ComparisonFilter";
import { MultiSelectFilter } from "../../components/filters/MultiSelectFilter";
import { PeriodFilter } from "../../components/filters/PeriodFilter";
import { useFilterOptions } from "../../components/filters/useFilterOptions";
import { Input, Switch } from "../../components/ui";
import { useDashboardStore } from "../../stores/dashboardStore";

/** Zone multi-select with search (265 zones from /api/meta). */
export function ZonePicker({
  value,
  onChange,
}: {
  value: readonly number[];
  onChange: (zones: number[]) => void;
}) {
  const zones = useMeta().data?.zones ?? [];
  const [query, setQuery] = useState("");
  const byId = new Map(zones.map((z) => [z.id, z]));
  const normalized = query.trim().toLowerCase();
  const matches =
    normalized === ""
      ? []
      : zones
          .filter(
            (z) =>
              !value.includes(z.id) &&
              (z.name.toLowerCase().includes(normalized) ||
                String(z.id) === normalized),
          )
          .slice(0, 8);

  if (zones.length === 0) {
    return (
      <p className="text-xs text-muted">A lista de zonas ainda não carregou.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Zonas escolhidas">
          {value.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pr-1 pl-2.5 text-xs text-ink"
            >
              {byId.get(id)?.name ?? `Zona ${String(id)}`}
              <button
                type="button"
                aria-label={`Tirar ${byId.get(id)?.name ?? String(id)}`}
                className="grid size-5 place-items-center rounded-full hover:bg-surface-2"
                onClick={() => {
                  onChange(value.filter((v) => v !== id));
                }}
              >
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        label="Buscar zona"
        type="search"
        placeholder="Ex.: JFK, Midtown, 132"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {matches.length > 0 && (
        <ul className="flex flex-col rounded-xl border border-border p-1">
          {matches.map((zone) => (
            <li key={zone.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-surface-2"
                onClick={() => {
                  onChange([...value, zone.id]);
                  setQuery("");
                }}
              >
                {zone.name}
                <span className="text-xs text-muted">
                  {BOROUGH_LABELS[zone.borough]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OverrideRow({
  label,
  description,
  on,
  onToggle,
  children,
}: {
  label: string;
  description: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-3 last:border-0">
      <Switch
        label={label}
        description={description}
        checked={on}
        onChange={onToggle}
      />
      {on && <div>{children}</div>}
    </div>
  );
}

/**
 * Per-widget filters (CLAUDE.md §6.2): each one either follows the global filter or has its own
 * value. Turning one on starts from the current global value.
 */
export function FilterOverrides({
  widget,
  onChange,
}: {
  widget: WidgetConfig;
  onChange: (widget: WidgetConfig) => void;
}) {
  const global = useDashboardStore((s) => s.state.filters);
  const options = useFilterOptions();
  const overrides: WidgetFilterOverrides = widget.filters ?? {};

  const set = <K extends keyof WidgetFilterOverrides>(
    key: K,
    value: WidgetFilterOverrides[K] | undefined,
  ) => {
    // Undefined fields are dropped: the widget follows the global filter again.
    const next = Object.fromEntries(
      (
        Object.entries({ ...overrides, [key]: value }) as [string, unknown][]
      ).filter(([, v]) => v !== undefined),
    ) as WidgetFilterOverrides;
    const { filters: _drop, ...rest } = widget;
    onChange(
      Object.keys(next).length === 0 ? rest : { ...widget, filters: next },
    );
  };
  const toggle =
    <K extends keyof WidgetFilterOverrides>(
      key: K,
      initial: WidgetFilterOverrides[K],
    ) =>
    (on: boolean) => {
      set(key, on ? initial : undefined);
    };

  const period = overrides.period ?? global.period;
  return (
    <div className="flex flex-col gap-3">
      <OverrideRow
        label="Período próprio"
        description="Ignora o período do topo da página."
        on={overrides.period !== undefined}
        onToggle={toggle("period", global.period)}
      >
        <PeriodFilter
          value={period}
          coverage={options.coverage}
          onChange={(value) => {
            set("period", value);
          }}
        />
      </OverrideRow>
      <OverrideRow
        label="Comparação própria"
        description="Ex.: sempre contra a projeção."
        on={overrides.comparison !== undefined}
        onToggle={toggle("comparison", global.comparison)}
      >
        <ComparisonFilter
          value={overrides.comparison ?? global.comparison}
          period={period}
          coverage={options.coverage}
          projection={
            options.projectionFrom && options.projectionUntil
              ? { from: options.projectionFrom, to: options.projectionUntil }
              : null
          }
          onChange={(value) => {
            set("comparison", value);
          }}
        />
      </OverrideRow>
      <OverrideRow
        label="Serviços próprios"
        description="Uma lista vazia (“Todos”) também ignora o filtro global."
        on={overrides.services !== undefined}
        onToggle={toggle("services", global.services)}
      >
        <MultiSelectFilter
          name="Serviço"
          icon={<CarTaxiFront size={16} />}
          options={options.services}
          value={overrides.services ?? []}
          onChange={(value) => {
            set("services", value);
          }}
        />
      </OverrideRow>
      <OverrideRow
        label="Empresas próprias"
        description="Uber e Lyft só existem no serviço de apps."
        on={overrides.companies !== undefined}
        onToggle={toggle("companies", global.companies)}
      >
        <MultiSelectFilter
          name="Empresa"
          icon={<Building2 size={16} />}
          options={options.companies}
          value={overrides.companies ?? []}
          onChange={(value) => {
            set("companies", value);
          }}
        />
      </OverrideRow>
      <OverrideRow
        label="Distritos próprios"
        description="Distritos de embarque."
        on={overrides.boroughs !== undefined}
        onToggle={toggle("boroughs", global.boroughs)}
      >
        <MultiSelectFilter
          name="Distrito"
          icon={<MapPinned size={16} />}
          options={options.boroughs}
          value={overrides.boroughs ?? []}
          onChange={(value) => {
            set("boroughs", value);
          }}
        />
      </OverrideRow>
      <OverrideRow
        label="Zonas"
        description="Só existe no widget. Não vale para dados por hora."
        on={overrides.zones !== undefined}
        onToggle={toggle("zones", [])}
      >
        <ZonePicker
          value={overrides.zones ?? []}
          onChange={(value) => {
            set("zones", value);
          }}
        />
      </OverrideRow>
    </div>
  );
}
