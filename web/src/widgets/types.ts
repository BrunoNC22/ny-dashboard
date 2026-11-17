import type {
  Breakpoint,
  WidgetConfig,
  WidgetConfigOf,
  WidgetType,
} from "@ny-dashboard/shared";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

import type { EffectiveFilters } from "./resolveFilters";

/** Props of a widget body for a given config shape (covariant in the config). */
export interface WidgetBodyProps<C extends WidgetConfig = WidgetConfig> {
  widget: C;
  /** Global filters merged with the widget's overrides. */
  filters: EffectiveFilters;
  breakpoint: Breakpoint;
  /** Rendered inside the editor preview (#42). */
  preview?: boolean;
}

/** `WidgetProps<"line" | "area">`: props for the widget types given. */
export type WidgetProps<T extends WidgetType = WidgetType> = WidgetBodyProps<
  WidgetConfigOf<T>
>;

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
