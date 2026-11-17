import type { Breakpoint, WidgetConfig } from "@ny-dashboard/shared";
import { Suspense, useMemo } from "react";

import { useDashboardStore } from "../stores/dashboardStore";
import { widgetDefinition } from "./registry";
import { resolveWidgetFilters } from "./resolveFilters";
import { WidgetBody } from "./WidgetBody";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { WidgetFrame } from "./WidgetFrame";

export interface WidgetRendererProps {
  widget: WidgetConfig;
  breakpoint: Breakpoint;
  /** Editor preview: no actions, no drag handle. */
  preview?: boolean;
}

/** Frame + the type's component with the effective filters, error boundary and lazy loading. */
export function WidgetRenderer({
  widget,
  breakpoint,
  preview = false,
}: WidgetRendererProps) {
  const global = useDashboardStore((s) => s.state.filters);
  const filters = useMemo(
    () => resolveWidgetFilters(global, widget.filters),
    [global, widget.filters],
  );
  const Body = widgetDefinition(widget.type).component;
  return (
    <WidgetFrame widget={widget} readOnly={preview}>
      <WidgetErrorBoundary resetKey={JSON.stringify(widget)}>
        <Suspense
          fallback={
            <WidgetBody
              status="loading"
              skeleton={widget.type === "kpi" ? "kpi" : "chart"}
            />
          }
        >
          <Body
            widget={widget}
            filters={filters}
            breakpoint={breakpoint}
            preview={preview}
          />
        </Suspense>
      </WidgetErrorBoundary>
    </WidgetFrame>
  );
}
