import "react-grid-layout/css/styles.css";
import "./grid.css";

import type { Breakpoint, WidgetConfig } from "@ny-dashboard/shared";
import { type ReactNode, useMemo } from "react";
import { type Layout, Responsive, useContainerWidth } from "react-grid-layout";

import { useDashboardStore } from "../../stores/dashboardStore";
import {
  breakpointForWidth,
  DRAG_HANDLE_CLASS,
  fromGridLayout,
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_MARGIN,
  ROW_HEIGHT,
  toGridLayouts,
} from "./gridConfig";

export interface DashboardGridProps {
  renderWidget: (widget: WidgetConfig, breakpoint: Breakpoint) => ReactNode;
  /** Fixed width (tests); measured from the container otherwise. */
  width?: number;
}

/**
 * Responsive react-grid-layout: desktop (12 cols) and mobile (2 cols) layouts are independent.
 * Always editable: drag by the widget header, resize by the bottom-right corner. Only
 * user-initiated changes (drag/resize stop) reach the store, so mounting or switching
 * breakpoints never marks the dashboard as edited.
 */
export function DashboardGrid({
  renderWidget,
  width: fixedWidth,
}: DashboardGridProps) {
  const { width: measured, containerRef, mounted } = useContainerWidth();
  const width = fixedWidth ?? measured;
  const state = useDashboardStore((s) => s.state);
  const updateLayout = useDashboardStore((s) => s.updateLayout);
  const breakpoint = breakpointForWidth(width);
  const layouts = useMemo(() => toGridLayouts(state), [state]);

  const commit = (layout: Layout) => {
    updateLayout(breakpoint, fromGridLayout(layout));
  };

  return (
    <div ref={containerRef} className="w-full">
      {(mounted || fixedWidth !== undefined) && (
        <Responsive
          width={width}
          layouts={layouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          margin={GRID_MARGIN}
          containerPadding={[0, 0]}
          dragConfig={{
            enabled: true,
            handle: `.${DRAG_HANDLE_CLASS}`,
            cancel: "button, a, input, select, textarea, [data-no-drag]",
          }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
          onDragStop={commit}
          onResizeStop={commit}
        >
          {state.widgets.map((widget) => (
            <div key={widget.id} data-widget-id={widget.id} className="flex">
              {renderWidget(widget, breakpoint)}
            </div>
          ))}
        </Responsive>
      )}
    </div>
  );
}
