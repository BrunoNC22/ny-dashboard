import {
  type Breakpoint,
  type DashboardState,
  GRID_COLUMNS,
  type GridItem,
  MOBILE_MAX_WIDTH_PX,
} from "@ny-dashboard/shared";
import type { LayoutItem } from "react-grid-layout";

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

/** Smallest widget per breakpoint (the widget registry can refine it per type, #40). */
export const MIN_SIZE: Readonly<
  Record<Breakpoint, { minW: number; minH: number }>
> = {
  desktop: { minW: 2, minH: 3 },
  mobile: { minW: 1, minH: 3 },
};

/** CSS class of the widget header used as drag handle (touch scroll stays free elsewhere). */
export const DRAG_HANDLE_CLASS = "widget-drag-handle";

export const breakpointForWidth = (width: number): Breakpoint =>
  width > GRID_BREAKPOINTS.desktop ? "desktop" : "mobile";

/** Store layouts → RGL layouts (with min sizes). */
export const toGridLayouts = (
  layouts: DashboardState["layouts"],
): Record<Breakpoint, LayoutItem[]> => ({
  desktop: layouts.desktop.map((item) => ({ ...item, ...MIN_SIZE.desktop })),
  mobile: layouts.mobile.map((item) => ({ ...item, ...MIN_SIZE.mobile })),
});

/** RGL layout → store grid items (only the persisted fields). */
export const fromGridLayout = (layout: readonly LayoutItem[]): GridItem[] =>
  layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
