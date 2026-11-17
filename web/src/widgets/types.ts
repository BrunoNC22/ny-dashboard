import type {
  Breakpoint,
  WidgetConfigOf,
  WidgetType,
} from "@ny-dashboard/shared";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

import type { EffectiveFilters } from "./resolveFilters";

export interface WidgetProps<T extends WidgetType = WidgetType> {
  widget: WidgetConfigOf<T>;
  /** Global filters merged with the widget's overrides. */
  filters: EffectiveFilters;
  breakpoint: Breakpoint;
  /** Rendered inside the editor preview (#42). */
  preview?: boolean;
}

export interface GridSize {
  w: number;
  h: number;
  minW: number;
  minH: number;
}

/** Gallery groups (#41). */
export type WidgetGroup =
  "kpi" | "series" | "composition" | "distribution" | "map" | "table";

export interface WidgetDefinition<T extends WidgetType = WidgetType> {
  type: T;
  label: string;
  icon: LucideIcon;
  group: WidgetGroup;
  /** Default and minimum size per breakpoint. */
  sizes: Readonly<Record<Breakpoint, GridSize>>;
  /** Heavy widgets (map, trip sample) are lazy components. */
  component: ComponentType<WidgetProps<T>>;
}
