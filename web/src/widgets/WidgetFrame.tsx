import type { WidgetConfig } from "@ny-dashboard/shared";
import { Copy, Funnel, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { DRAG_HANDLE_CLASS } from "../components/grid/gridConfig";
import { cn, IconButton, toast, Tooltip } from "../components/ui";
import { useDashboardStore } from "../stores/dashboardStore";
import { useUiStore } from "../stores/uiStore";
import { widgetDefinition, widgetIcon } from "./registry";
import { overriddenFilterLabels } from "./resolveFilters";

export interface WidgetFrameProps {
  widget: WidgetConfig;
  children: ReactNode;
  /** Hide the actions (editor preview). */
  readOnly?: boolean;
  className?: string;
}

/**
 * Glass shell of every widget: the header is the grid drag handle and carries the type icon,
 * the title, a badge when the widget overrides global filters, and edit / duplicate / remove.
 */
export function WidgetFrame({
  widget,
  children,
  readOnly = false,
  className,
}: WidgetFrameProps) {
  const { label } = widgetDefinition(widget.type);
  const overridden = overriddenFilterLabels(widget.filters);
  const editWidget = useUiStore((s) => s.editWidget);
  const duplicateWidget = useDashboardStore((s) => s.duplicateWidget);
  const removeWidget = useDashboardStore((s) => s.removeWidget);

  return (
    <section
      aria-label={widget.title}
      className={cn(
        "glass group/widget flex min-w-0 flex-1 flex-col overflow-hidden rounded-card",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex items-center gap-2 px-3 pt-2.5 pb-1.5",
          !readOnly && DRAG_HANDLE_CLASS,
        )}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-gradient text-on-accent"
          title={label}
        >
          {widgetIcon(widget.type, 15)}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {widget.title}
        </h2>
        {overridden.length > 0 && (
          <Tooltip content={`Filtros próprios: ${overridden.join(", ")}`}>
            <span
              tabIndex={0}
              data-no-drag
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-ink-2"
            >
              <Funnel size={11} className="text-accent" aria-hidden />
              {overridden.length}
              <span className="sr-only">
                filtros próprios: {overridden.join(", ")}
              </span>
            </span>
          </Tooltip>
        )}
        {!readOnly && (
          <>
            {/* Phones: edit only (duplicate/remove live in the editor; no hover on touch). */}
            <IconButton
              size="sm"
              className="md:hidden"
              label={`Editar ${widget.title}`}
              icon={<Pencil size={14} />}
              onClick={() => {
                editWidget(widget.id);
              }}
            />
            {/* Desktop: actions float over the header on hover/focus, so titles keep their width. */}
            <div className="glass absolute top-1.5 right-2 hidden items-center rounded-xl opacity-0 shadow-lg transition-opacity group-focus-within/widget:opacity-100 group-hover/widget:opacity-100 md:flex">
              <IconButton
                size="sm"
                label={`Editar ${widget.title}`}
                icon={<Pencil size={14} />}
                onClick={() => {
                  editWidget(widget.id);
                }}
              />
              <IconButton
                size="sm"
                label={`Duplicar ${widget.title}`}
                icon={<Copy size={14} />}
                onClick={() => {
                  duplicateWidget(widget.id);
                }}
              />
              <IconButton
                size="sm"
                label={`Remover ${widget.title}`}
                icon={<Trash2 size={14} />}
                onClick={() => {
                  removeWidget(widget.id);
                  toast.info(`“${widget.title}” removido. Ctrl+Z desfaz.`);
                }}
              />
            </div>
          </>
        )}
      </div>
      <div className="relative min-h-0 flex-1 px-3 pb-3">{children}</div>
    </section>
  );
}
