import {
  type MetricId,
  METRICS,
  type WidgetConfig,
  type WidgetConfigOf,
} from "@ny-dashboard/shared";

import { Input, SegmentedControl, Select, Switch } from "../../components/ui";
import {
  CATEGORICAL_OPTIONS,
  COLOR_BY_OPTIONS,
  GRANULARITY_OPTIONS,
  MAP_LAYER_OPTIONS,
  METRIC_OPTIONS,
  SERIES_GROUP_OPTIONS,
  TABLE_DIMENSION_OPTIONS,
  TRIP_FIELD_OPTIONS,
  UNIT_LABELS,
} from "./options";

type OnChange = (widget: WidgetConfig) => void;

/** Integer input that only reports values inside [min, max]. */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | "any";
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <Input
      label={suffix ? `${label} (${suffix})` : label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      defaultValue={value}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (event.target.value !== "" && next >= min && next <= max) {
          onChange(next);
        }
      }}
    />
  );
}

function CheckboxList<T extends string>({
  legend,
  options,
  value,
  onChange,
  max,
}: {
  legend: string;
  options: readonly { id: T; label: string }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  max?: number;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-medium text-ink-2">{legend}</legend>
      {options.map((option) => {
        const checked = value.includes(option.id);
        const blocked =
          (!checked && max !== undefined && value.length >= max) ||
          (checked && value.length === 1);
        return (
          <label
            key={option.id}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm text-ink has-[:disabled]:opacity-50"
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--nyd-accent)]"
              checked={checked}
              disabled={blocked}
              onChange={() => {
                onChange(
                  checked
                    ? value.filter((v) => v !== option.id)
                    : options
                        .map((o) => o.id)
                        .filter((id) => id === option.id || value.includes(id)),
                );
              }}
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}

export function MetricField({
  value,
  onChange,
}: {
  value: MetricId;
  onChange: (metric: MetricId) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Select
        label="Métrica"
        value={value}
        options={METRIC_OPTIONS}
        onChange={onChange}
      />
      <p className="text-xs text-muted">{METRICS[value].description}</p>
    </div>
  );
}

type SeriesWidget = WidgetConfigOf<"line" | "area" | "bar" | "stacked_bar">;

export function SeriesFields({
  widget,
  onChange,
}: {
  widget: SeriesWidget;
  onChange: OnChange;
}) {
  const hourly = widget.granularity === "hour";
  return (
    <>
      <MetricField
        value={widget.metric}
        onChange={(metric) => {
          onChange({ ...widget, metric });
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Granularidade"
          value={widget.granularity}
          options={GRANULARITY_OPTIONS}
          onChange={(granularity) => {
            // The projection only exists per day or coarser.
            onChange({
              ...widget,
              granularity,
              showProjection:
                granularity === "hour" ? false : widget.showProjection,
            });
          }}
        />
        <Select
          label="Agrupar séries por"
          value={widget.groupBy ?? "none"}
          options={
            widget.type === "stacked_bar"
              ? SERIES_GROUP_OPTIONS.filter((o) => o.value !== "none")
              : SERIES_GROUP_OPTIONS
          }
          onChange={(groupBy) => {
            if (groupBy === "none") {
              if (widget.type === "stacked_bar") return;
              const { groupBy: _drop, ...rest } = widget;
              onChange(rest);
            } else {
              onChange({ ...widget, groupBy });
            }
          }}
        />
      </div>
      {hourly && (
        <p className="text-xs text-muted">
          Por hora não há distrito nem zona (os dados horários não têm zona).
        </p>
      )}
      <Switch
        label="Mostrar a projeção"
        description="Holt-Winters sobreposto, em pontilhado (dia, semana ou mês)."
        checked={widget.showProjection}
        disabled={hourly}
        onChange={(showProjection) => {
          onChange({ ...widget, showProjection });
        }}
      />
    </>
  );
}

type CategoricalWidget = WidgetConfigOf<
  "doughnut" | "pie" | "radar" | "polar_area" | "bar_horizontal"
>;

export function CategoricalFields({
  widget,
  onChange,
}: {
  widget: CategoricalWidget;
  onChange: OnChange;
}) {
  return (
    <>
      <MetricField
        value={widget.metric}
        onChange={(metric) => {
          onChange({ ...widget, metric });
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Dividir por"
          value={widget.dimension}
          options={CATEGORICAL_OPTIONS}
          onChange={(dimension) => {
            onChange({ ...widget, dimension });
          }}
        />
        <NumberField
          key={widget.dimension}
          label="Máximo de categorias"
          value={widget.topN ?? 10}
          min={2}
          max={50}
          onChange={(topN) => {
            onChange({ ...widget, topN });
          }}
        />
      </div>
      <p className="text-xs text-muted">
        As demais categorias são somadas em “Outros”.
      </p>
    </>
  );
}

export function SampleFields({
  widget,
  onChange,
}: {
  widget: WidgetConfigOf<"scatter" | "bubble">;
  onChange: OnChange;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Eixo X"
          value={widget.x}
          options={TRIP_FIELD_OPTIONS}
          onChange={(x) => {
            onChange({ ...widget, x });
          }}
        />
        <Select
          label="Eixo Y"
          value={widget.y}
          options={TRIP_FIELD_OPTIONS}
          onChange={(y) => {
            onChange({ ...widget, y });
          }}
        />
        {widget.type === "bubble" && (
          <Select
            label="Raio da bolha"
            value={widget.r}
            options={TRIP_FIELD_OPTIONS}
            onChange={(r) => {
              onChange({ ...widget, r });
            }}
          />
        )}
        <Select
          label="Cor por"
          value={widget.colorBy}
          options={COLOR_BY_OPTIONS}
          onChange={(colorBy) => {
            onChange({ ...widget, colorBy });
          }}
        />
      </div>
      <p className="text-xs text-muted">
        Usa a amostra de corridas do último mês. Sem filtro de zona, são até 1
        milhão de pontos (o gráfico fica lento de propósito).
      </p>
    </>
  );
}

export function KpiFields({
  widget,
  onChange,
}: {
  widget: WidgetConfigOf<"kpi">;
  onChange: OnChange;
}) {
  const { evaluation } = widget;
  const defaultDirection = METRICS[widget.metric].direction;
  const setEvaluation = (patch: Partial<typeof evaluation>) => {
    onChange({ ...widget, evaluation: { ...evaluation, ...patch } });
  };
  return (
    <>
      <MetricField
        value={widget.metric}
        onChange={(metric) => {
          onChange({ ...widget, metric });
        }}
      />
      <Switch
        label="Mostrar minigráfico"
        checked={widget.sparkline}
        onChange={(sparkline) => {
          onChange({ ...widget, sparkline });
        }}
      />
      <SegmentedControl
        label="O que é bom"
        value={evaluation.direction ?? "default"}
        options={[
          {
            value: "default",
            label: `Padrão (${defaultDirection === "higher_is_better" ? "maior" : "menor"} é melhor)`,
          },
          { value: "higher_is_better", label: "Maior é melhor" },
          { value: "lower_is_better", label: "Menor é melhor" },
        ]}
        onChange={(direction) => {
          if (direction === "default") {
            const { direction: _drop, ...rest } = evaluation;
            onChange({ ...widget, evaluation: rest });
          } else {
            setEvaluation({ direction });
          }
        }}
        size="sm"
      />
      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-xs font-medium text-ink-2">
          Status pela comparação
        </legend>
        <Switch
          label="Avaliar a variação contra a comparação"
          checked={evaluation.comparison.enabled}
          onChange={(enabled) => {
            setEvaluation({
              comparison: { ...evaluation.comparison, enabled },
            });
          }}
        />
        {evaluation.comparison.enabled && (
          <NumberField
            label="Faixa estável"
            suffix="± %"
            value={evaluation.comparison.neutralBandPct}
            min={0}
            max={100}
            step={0.5}
            onChange={(neutralBandPct) => {
              setEvaluation({
                comparison: { ...evaluation.comparison, neutralBandPct },
              });
            }}
          />
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-xs font-medium text-ink-2">
          Status pela meta
        </legend>
        <Switch
          label="Usar uma meta"
          checked={evaluation.target !== null}
          onChange={(on) => {
            setEvaluation({
              target: on ? { value: 0, warningBandPct: 5 } : null,
            });
          }}
        />
        {evaluation.target !== null && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Meta"
              suffix={UNIT_LABELS[METRICS[widget.metric].unit]}
              value={evaluation.target.value}
              min={-1e12}
              max={1e12}
              step="any"
              onChange={(value) => {
                if (evaluation.target)
                  setEvaluation({ target: { ...evaluation.target, value } });
              }}
            />
            <NumberField
              label="Atenção até"
              suffix="% abaixo"
              value={evaluation.target.warningBandPct}
              min={0}
              max={100}
              onChange={(warningBandPct) => {
                if (evaluation.target)
                  setEvaluation({
                    target: { ...evaluation.target, warningBandPct },
                  });
              }}
            />
          </div>
        )}
      </fieldset>
    </>
  );
}

export function TableFields({
  widget,
  onChange,
}: {
  widget: WidgetConfigOf<"table">;
  onChange: OnChange;
}) {
  const columnOptions = METRIC_OPTIONS.map((o) => ({
    id: o.value,
    label: METRICS[o.value].label,
  }));
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Linhas"
          value={widget.dimension}
          options={TABLE_DIMENSION_OPTIONS}
          onChange={(dimension) => {
            onChange({ ...widget, dimension });
          }}
        />
        <NumberField
          label="Quantidade de linhas"
          value={widget.limit}
          min={5}
          max={100}
          onChange={(limit) => {
            onChange({ ...widget, limit });
          }}
        />
        <Select
          label="Ordenar por"
          value={widget.sortBy}
          options={widget.columns.map((id) => ({
            value: id,
            label: METRICS[id].label,
          }))}
          onChange={(sortBy) => {
            onChange({ ...widget, sortBy });
          }}
        />
        <SegmentedControl
          label="Ordem"
          value={widget.sortDir}
          options={[
            { value: "desc", label: "Maior primeiro" },
            { value: "asc", label: "Menor primeiro" },
          ]}
          onChange={(sortDir) => {
            onChange({ ...widget, sortDir });
          }}
          size="sm"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-border p-2">
        <CheckboxList
          legend="Colunas (até 6)"
          options={columnOptions}
          value={widget.columns}
          max={6}
          onChange={(columns) => {
            onChange({
              ...widget,
              columns,
              sortBy: columns.includes(widget.sortBy)
                ? widget.sortBy
                : (columns[0] ?? widget.sortBy),
            });
          }}
        />
      </div>
    </>
  );
}

export function MapFields({
  widget,
  onChange,
}: {
  widget: WidgetConfigOf<"map">;
  onChange: OnChange;
}) {
  return (
    <>
      <MetricField
        value={widget.metric}
        onChange={(metric) => {
          onChange({ ...widget, metric });
        }}
      />
      <CheckboxList
        legend="Camadas"
        options={MAP_LAYER_OPTIONS}
        value={widget.layers}
        onChange={(layers) => {
          onChange({ ...widget, layers });
        }}
      />
      <Select
        label="Cor dos pontos por"
        value={widget.colorBy}
        options={COLOR_BY_OPTIONS}
        onChange={(colorBy) => {
          onChange({ ...widget, colorBy });
        }}
      />
      <p className="text-xs text-muted">
        A métrica vale para zonas, bolhas e rotas. Calor, pontos e hexágonos
        usam a amostra de corridas (posição aproximada dentro da zona).
      </p>
    </>
  );
}
