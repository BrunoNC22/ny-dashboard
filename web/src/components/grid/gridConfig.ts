import {
  type Breakpoint,
  type DashboardState,
  GRID_COLUMNS,
  type GridItem,
  MOBILE_MAX_WIDTH_PX,
} from "@ny-dashboard/shared";
import type { LayoutItem } from "react-grid-layout";

import { WIDGET_REGISTRY } from "../../widgets/registry";

/**
 * Grid geometry (CLAUDE.md §6.4). Breakpoints are measured on the grid container (RGL picks the
 * largest breakpoint strictly smaller than the width): desktop from 768px, mobile below.
 */
export const GRID_BREAKPOINTS: Readonly<Record<Breakpoint, number>> = {
  desktop: MOBILE_MAX_WIDTH_PX,
  mobile: 0,
};
export const GRID_COLS: Readonly<Record<Breakpoint, number>> = GRID_COLUMNS;
export const ROW_HEIGHT = 40;
export const GRID_MARGIN: Readonly<
  Record<Breakpoint, readonly [number, number]>
> = {
  desktop: [16, 16],
  mobile: [12, 12],
};

/** CSS class of the widget header used as drag handle (touch scroll stays free elsewhere). */
export const DRAG_HANDLE_CLASS = "widget-drag-handle";

export const breakpointForWidth = (width: number): Breakpoint =>
  width > GRID_BREAKPOINTS.desktop ? "desktop" : "mobile";

/** Store layouts → RGL layouts, with each widget type's minimum size from the registry. */
export const toGridLayouts = (
  state: Pick<DashboardState, "layouts" | "widgets">,
): Record<Breakpoint, LayoutItem[]> => {
  const types = new Map(state.widgets.map((w) => [w.id, w.type]));
  const withMin = (breakpoint: Breakpoint) =>
    state.layouts[breakpoint].map((item) => {
      const type = types.get(item.i);
      const min = type ? WIDGET_REGISTRY[type].sizes[breakpoint] : undefined;
      return min ? { ...item, minW: min.minW, minH: min.minH } : { ...item };
    });
  return { desktop: withMin("desktop"), mobile: withMin("mobile") };
};

/** RGL layout → store grid items (only the persisted fields). */
export const fromGridLayout = (layout: readonly LayoutItem[]): GridItem[] =>
  layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
