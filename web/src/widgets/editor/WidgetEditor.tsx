import {
  type WidgetConfig,
  widgetConfigSchema,
  type WidgetType,
} from "@ny-dashboard/shared";
import { Copy, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, Input, Modal, Select, Tabs, toast } from "../../components/ui";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useUiStore } from "../../stores/uiStore";
import { WIDGET_REGISTRY } from "../registry";
import { WidgetBody } from "../WidgetBody";
import { WidgetRenderer } from "../WidgetRenderer";
import { compatibleTypes, convertWidgetType } from "./convert";
import { FilterOverrides } from "./FilterOverrides";
import {
  CategoricalFields,
  KpiFields,
  MapFields,
  SampleFields,
  SeriesFields,
  TableFields,
} from "./TypeFields";

type OnChange = (widget: WidgetConfig) => void;

function TypeSpecificFields({
  widget,
  onChange,
}: {
  widget: WidgetConfig;
  onChange: OnChange;
}) {
  switch (widget.type) {
    case "line":
    case "area":
    case "bar":
    case "stacked_bar":
      return <SeriesFields widget={widget} onChange={onChange} />;
    case "doughnut":
    case "pie":
    case "radar":
    case "polar_area":
    case "bar_horizontal":
      return <CategoricalFields widget={widget} onChange={onChange} />;
    case "scatter":
    case "bubble":
      return <SampleFields widget={widget} onChange={onChange} />;
    case "kpi":
      return <KpiFields widget={widget} onChange={onChange} />;
    case "table":
      return <TableFields widget={widget} onChange={onChange} />;
    case "map":
      return <MapFields widget={widget} onChange={onChange} />;
  }
}

/** First validation message, in pt-BR when the shared schema has one. */
const validationMessage = (widget: WidgetConfig): string | null => {
  const parsed = widgetConfigSchema.safeParse(widget);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  if (!issue) return "Configuração inválida.";
  if (issue.path[0] === "title") return "Dê um título ao widget.";
  return `Configuração inválida: ${issue.message}`;
};

function EditorBody({
  original,
  onClose,
}: {
  original: WidgetConfig;
  onClose: () => void;
}) {
  const updateWidget = useDashboardStore((s) => s.updateWidget);
  const duplicateWidget = useDashboardStore((s) => s.duplicateWidget);
  const removeWidget = useDashboardStore((s) => s.removeWidget);
  const [draft, setDraft] = useState<WidgetConfig>(() =>
    structuredClone(original),
  );
  const [tab, setTab] = useState<"data" | "filters">("data");
  const error = validationMessage(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(original);

  const save = () => {
    const parsed = widgetConfigSchema.safeParse(draft);
    if (!parsed.success) return;
    if (changed) updateWidget(parsed.data);
    onClose();
  };

  const typeOptions = compatibleTypes(original.type).map((type) => ({
    value: type,
    label: WIDGET_REGISTRY[type].label,
  }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              label="Título"
              value={draft.title}
              maxLength={80}
              onChange={(event) => {
                setDraft({ ...draft, title: event.target.value });
              }}
            />
            {typeOptions.length > 1 && (
              <Select
                label="Tipo"
                value={draft.type}
                options={typeOptions}
                onChange={(type: WidgetType) => {
                  setDraft(convertWidgetType(draft, type));
                }}
              />
            )}
          </div>
          <Tabs
            label="Configuração do widget"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: "data",
                label: "Dados",
                content: (
                  <div className="flex flex-col gap-4 pt-3">
                    <TypeSpecificFields widget={draft} onChange={setDraft} />
                  </div>
                ),
              },
              {
                value: "filters",
                label: "Filtros",
                content: (
                  <div className="pt-3">
                    <FilterOverrides widget={draft} onChange={setDraft} />
                  </div>
                ),
              },
            ]}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Prévia
          </p>
          <div
            className="flex h-72 lg:h-96"
            data-testid="widget-preview"
            aria-label="Prévia do widget"
          >
            {error === null ? (
              <WidgetRenderer widget={draft} breakpoint="desktop" preview />
            ) : (
              <div className="glass flex flex-1 rounded-card p-4">
                <WidgetBody status="error" message={error} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          icon={<Copy size={14} />}
          onClick={() => {
            duplicateWidget(original.id);
            toast.success(`Cópia de “${original.title}” criada.`);
            onClose();
          }}
        >
          Duplicar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={14} />}
          onClick={() => {
            removeWidget(original.id);
            toast.info(`“${original.title}” removido. Ctrl+Z desfaz.`);
            onClose();
          }}
        >
          Remover
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          icon={<Save size={16} />}
          disabled={error !== null}
        >
          Salvar
        </Button>
      </div>
    </form>
  );
}

/** Editor modal with live preview (CLAUDE.md §6.1). Saving is one undoable step. */
export function WidgetEditor() {
  const editingId = useUiStore((s) => s.editingWidgetId);
  const close = useUiStore((s) => s.closeEditor);
  const widget = useDashboardStore((s) =>
    s.state.widgets.find((w) => w.id === editingId),
  );
  return (
    <Modal
      open={widget !== undefined}
      onClose={close}
      size="xl"
      title={widget ? `Editar “${widget.title}”` : "Editar widget"}
    >
      {widget && (
        <EditorBody key={widget.id} original={widget} onClose={close} />
      )}
    </Modal>
  );
}
