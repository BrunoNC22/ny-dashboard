import { Zap } from "lucide-react";
import { useState } from "react";

import { Badge, Input, Modal, toast } from "../components/ui";
import { useDashboardStore } from "../stores/dashboardStore";
import { useUiStore } from "../stores/uiStore";
import { WIDGET_REGISTRY, widgetIcon } from "./registry";
import {
  GROUP_LABELS,
  instantiateTemplate,
  searchTemplates,
  WIDGET_TEMPLATES,
  type WidgetTemplate,
} from "./templates";
import type { WidgetGroup } from "./types";

const GROUP_ORDER = Object.keys(GROUP_LABELS) as WidgetGroup[];

/** "Adicionar widget": ready-made templates by group, with search (CLAUDE.md §6.1). */
export function WidgetGallery() {
  const open = useUiStore((s) => s.galleryOpen);
  const close = useUiStore((s) => s.closeGallery);
  const addWidget = useDashboardStore((s) => s.addWidget);
  const [query, setQuery] = useState("");
  const results = searchTemplates(WIDGET_TEMPLATES, query);

  const add = (template: WidgetTemplate) => {
    const { widget, sizes } = instantiateTemplate(template);
    addWidget(widget, sizes);
    close();
    setQuery("");
    toast.success(
      `“${widget.title}” adicionado. Use o lápis para personalizar.`,
    );
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-widget-id="${widget.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Adicionar widget"
      description="Escolha um modelo pronto. Depois, personalize métrica, filtros e visual no editor."
    >
      <div className="flex flex-col gap-5">
        <Input
          label="Buscar modelos"
          hideLabel
          type="search"
          placeholder="Buscar modelos (ex.: receita, mapa, hora)"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        {results.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            Nenhum modelo encontrado para “{query}”.
          </p>
        )}
        {GROUP_ORDER.map((group) => {
          const templates = results.filter((t) => t.group === group);
          if (templates.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`gallery-${group}`}>
              <h3
                id={`gallery-${group}`}
                className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase"
              >
                {GROUP_LABELS[group]}
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => {
                        add(template);
                      }}
                      className="flex h-full w-full items-start gap-3 rounded-2xl border border-border bg-surface-glass p-3 text-left transition hover:border-accent/60 hover:bg-surface-2 hover:shadow-[0_0_24px_-8px_var(--nyd-accent-glow)]"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-gradient text-on-accent">
                        {widgetIcon(template.draft.type, 18)}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
                          {template.name}
                          {template.heavy === true && (
                            <Badge tone="warning" withIcon={false}>
                              <Zap size={11} aria-hidden /> pesado
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-ink-2">
                          {WIDGET_REGISTRY[template.draft.type].label} ·{" "}
                          {template.description}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
