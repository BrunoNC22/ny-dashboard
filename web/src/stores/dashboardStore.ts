import {
  type Breakpoint,
  BREAKPOINTS,
  createDefaultDashboard,
  type DashboardState,
  type GlobalFilters,
  GRID_COLUMNS,
  type GridItem,
  type WidgetConfig,
} from "@ny-dashboard/shared";
import { create } from "zustand";

/** Undo/redo depth (CLAUDE.md §6.4). */
export const HISTORY_LIMIT = 50;

export interface WidgetSize {
  w: number;
  h: number;
}
export type WidgetSizes = Readonly<Record<Breakpoint, WidgetSize>>;

/** Size of a new widget when the caller does not specify one. */
export const DEFAULT_WIDGET_SIZES: WidgetSizes = {
  desktop: { w: 6, h: 8 },
  mobile: { w: 2, h: 7 },
};

export interface DashboardStore {
  state: DashboardState;
  past: DashboardState[];
  future: DashboardState[];
  /** Local edits not yet saved to the server. */
  dirty: boolean;
  /** Increments on every local edit (autosave debounce key). */
  revision: number;

  /** Replaces the whole state without history (hydration from server / storage). */
  hydrate: (state: DashboardState) => void;
  addWidget: (widget: WidgetConfig, sizes?: WidgetSizes) => void;
  updateWidget: (widget: WidgetConfig) => void;
  duplicateWidget: (id: string) => string | undefined;
  removeWidget: (id: string) => void;
  /** Positions/sizes of one breakpoint (the other is untouched). No-op if unchanged. */
  updateLayout: (breakpoint: Breakpoint, items: readonly GridItem[]) => void;
  setFilters: (filters: Partial<GlobalFilters>) => void;
  resetToDefault: () => void;
  undo: () => void;
  redo: () => void;
  /** Marks the current revision as saved (if nothing changed meanwhile). */
  markSaved: (revision: number) => void;
}

/** Random widget id compatible with the shared `widgetIdSchema`. */
export const newWidgetId = (type: string): string =>
  `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.replace(
    /[^A-Za-z0-9_-]/g,
    "",
  );

const bottomOf = (items: readonly GridItem[]) =>
  items.reduce((max, i) => Math.max(max, i.y + i.h), 0);

const placeAtBottom = (
  items: readonly GridItem[],
  id: string,
  size: WidgetSize,
  breakpoint: Breakpoint,
): GridItem => ({
  i: id,
  x: 0,
  y: bottomOf(items),
  w: Math.min(size.w, GRID_COLUMNS[breakpoint]),
  h: size.h,
});

/** Layout items with only the grid fields, sorted, for a stable comparison. */
const normalize = (items: readonly GridItem[]): GridItem[] =>
  items
    .map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
    .sort((a, b) => a.i.localeCompare(b.i));

const sameLayout = (a: readonly GridItem[], b: readonly GridItem[]) =>
  JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

export const useDashboardStore = create<DashboardStore>((set, get) => {
  /** Applies a local edit: pushes the current state to the history and clears redo. */
  const commit = (next: DashboardState) => {
    const { state, past, revision } = get();
    set({
      state: next,
      past: [...past, state].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
      revision: revision + 1,
    });
  };

  return {
    state: createDefaultDashboard(),
    past: [],
    future: [],
    dirty: false,
    revision: 0,

    hydrate: (state) => {
      set({
        state: structuredClone(state),
        past: [],
        future: [],
        dirty: false,
      });
    },

    addWidget: (widget, sizes = DEFAULT_WIDGET_SIZES) => {
      const { state } = get();
      const layouts = Object.fromEntries(
        BREAKPOINTS.map((bp) => [
          bp,
          [
            ...state.layouts[bp],
            placeAtBottom(state.layouts[bp], widget.id, sizes[bp], bp),
          ],
        ]),
      ) as DashboardState["layouts"];
      commit({ ...state, widgets: [...state.widgets, widget], layouts });
    },

    updateWidget: (widget) => {
      const { state } = get();
      if (!state.widgets.some((w) => w.id === widget.id)) return;
      commit({
        ...state,
        widgets: state.widgets.map((w) => (w.id === widget.id ? widget : w)),
      });
    },

    duplicateWidget: (id) => {
      const { state } = get();
      const original = state.widgets.find((w) => w.id === id);
      if (!original) return undefined;
      const copy = {
        ...structuredClone(original),
        id: newWidgetId(original.type),
      };
      const sizes = Object.fromEntries(
        BREAKPOINTS.map((bp) => {
          const item = state.layouts[bp].find((i) => i.i === id);
          return [
            bp,
            item ? { w: item.w, h: item.h } : DEFAULT_WIDGET_SIZES[bp],
          ];
        }),
      ) as WidgetSizes;
      get().addWidget(copy, sizes);
      return copy.id;
    },

    removeWidget: (id) => {
      const { state } = get();
      if (!state.widgets.some((w) => w.id === id)) return;
      commit({
        ...state,
        widgets: state.widgets.filter((w) => w.id !== id),
        layouts: {
          desktop: state.layouts.desktop.filter((i) => i.i !== id),
          mobile: state.layouts.mobile.filter((i) => i.i !== id),
        },
      });
    },

    updateLayout: (breakpoint, items) => {
      const { state } = get();
      const known = new Set(state.widgets.map((w) => w.id));
      const next = items
        .filter((item) => known.has(item.i))
        .map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
      if (
        next.length !== state.widgets.length ||
        sameLayout(next, state.layouts[breakpoint])
      )
        return;
      commit({ ...state, layouts: { ...state.layouts, [breakpoint]: next } });
    },

    setFilters: (filters) => {
      const { state } = get();
      commit({ ...state, filters: { ...state.filters, ...filters } });
    },

    resetToDefault: () => {
      commit(createDefaultDashboard());
    },

    undo: () => {
      const { state, past, future, revision } = get();
      const previous = past.at(-1);
      if (!previous) return;
      set({
        state: previous,
        past: past.slice(0, -1),
        future: [state, ...future],
        dirty: true,
        revision: revision + 1,
      });
    },

    redo: () => {
      const { state, past, future, revision } = get();
      const [next, ...rest] = future;
      if (!next) return;
      set({
        state: next,
        past: [...past, state].slice(-HISTORY_LIMIT),
        future: rest,
        dirty: true,
        revision: revision + 1,
      });
    },

    markSaved: (revision) => {
      if (get().revision === revision) set({ dirty: false });
    },
  };
});

/** Selectors. */
export const selectCanUndo = (s: DashboardStore) => s.past.length > 0;
export const selectCanRedo = (s: DashboardStore) => s.future.length > 0;
