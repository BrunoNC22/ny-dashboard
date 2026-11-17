import { z } from "zod";

import { globalFiltersSchema } from "./filters";
import { widgetConfigSchema } from "./widgets";

/** Layout breakpoints (CLAUDE.md §6.4): desktop >= 768px, mobile < 768px. */
export const BREAKPOINTS = ["desktop", "mobile"] as const;
export const breakpointSchema = z.enum(BREAKPOINTS);
export type Breakpoint = z.infer<typeof breakpointSchema>;

export const MOBILE_MAX_WIDTH_PX = 767;
export const GRID_COLUMNS: Readonly<Record<Breakpoint, number>> = {
  desktop: 12,
  mobile: 2,
};
export const MAX_WIDGETS = 50;

/** react-grid-layout item; `i` is the widget id. */
export const gridItemSchema = z.object({
  i: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});
export type GridItem = z.infer<typeof gridItemSchema>;

export const layoutsSchema = z.object({
  desktop: z.array(gridItemSchema),
  mobile: z.array(gridItemSchema),
});
export type Layouts = z.infer<typeof layoutsSchema>;

export const DASHBOARD_STATE_VERSION = 1;

/**
 * Full dashboard state, saved as a whole on every change (CLAUDE.md §6.5).
 * Widgets are shared by both layouts; each layout has its own positions/sizes.
 */
export const dashboardStateSchema = z
  .object({
    version: z.literal(DASHBOARD_STATE_VERSION),
    filters: globalFiltersSchema,
    widgets: z.array(widgetConfigSchema).max(MAX_WIDGETS),
    layouts: layoutsSchema,
  })
  .superRefine((state, ctx) => {
    const widgetIds = new Set<string>();
    state.widgets.forEach((widget, index) => {
      if (widgetIds.has(widget.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate widget id "${widget.id}"`,
          path: ["widgets", index, "id"],
        });
      }
      widgetIds.add(widget.id);
    });

    for (const breakpoint of BREAKPOINTS) {
      const columns = GRID_COLUMNS[breakpoint];
      const seen = new Set<string>();
      state.layouts[breakpoint].forEach((item, index) => {
        const path = ["layouts", breakpoint, index];
        if (!widgetIds.has(item.i)) {
          ctx.addIssue({
            code: "custom",
            message: `Unknown widget "${item.i}"`,
            path,
          });
        }
        if (seen.has(item.i)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate layout item "${item.i}"`,
            path,
          });
        }
        seen.add(item.i);
        if (item.x + item.w > columns) {
          ctx.addIssue({
            code: "custom",
            message: `Item "${item.i}" exceeds the ${String(columns)} ${breakpoint} columns`,
            path,
          });
        }
      });
      for (const id of widgetIds) {
        if (!seen.has(id)) {
          ctx.addIssue({
            code: "custom",
            message: `Widget "${id}" is missing from the ${breakpoint} layout`,
            path: ["layouts", breakpoint],
          });
        }
      }
    }
  });
export type DashboardState = z.infer<typeof dashboardStateSchema>;

// ── API contracts (/api/dashboard) ─────────────────────────────────────────────

/** Body of `PUT /api/dashboard`. */
export const saveDashboardRequestSchema = z.object({
  state: dashboardStateSchema,
});
export type SaveDashboardRequest = z.infer<typeof saveDashboardRequestSchema>;

/** Response of `GET`/`PUT /api/dashboard`. */
export const dashboardResponseSchema = z.object({
  state: dashboardStateSchema,
  /** ISO timestamp of the last save (last write wins; CLAUDE.md §6.5). */
  updatedAt: z.iso.datetime(),
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
