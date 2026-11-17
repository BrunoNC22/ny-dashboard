import type { WidgetConfig, WidgetType } from "@ny-dashboard/shared";

/** Types sharing the same config shape: the editor can switch between them (CLAUDE.md §6.1). */
export const TYPE_FAMILIES: readonly (readonly WidgetType[])[] = [
  ["line", "area", "bar", "stacked_bar"],
  ["doughnut", "pie", "radar", "polar_area", "bar_horizontal"],
  ["scatter", "bubble"],
  ["kpi"],
  ["table"],
  ["map"],
];

export const compatibleTypes = (type: WidgetType): readonly WidgetType[] =>
  TYPE_FAMILIES.find((family) => family.includes(type)) ?? [type];

/** Same widget as another type of its family, keeping every field that still applies. */
export const convertWidgetType = (
  widget: WidgetConfig,
  type: WidgetType,
): WidgetConfig => {
  if (widget.type === type) return widget;
  if (!compatibleTypes(widget.type).includes(type)) {
    throw new Error(`Cannot convert ${widget.type} to ${type}`);
  }
  switch (widget.type) {
    case "line":
    case "area":
    case "bar":
    case "stacked_bar": {
      const { type: _from, ...rest } = widget;
      if (type === "stacked_bar") {
        return { ...rest, type, groupBy: rest.groupBy ?? "service" };
      }
      return { ...rest, type: type as "line" | "area" | "bar" };
    }
    case "doughnut":
    case "pie":
    case "radar":
    case "polar_area":
    case "bar_horizontal": {
      const { type: _from, ...rest } = widget;
      // Same shape for every categorical type.
      return { ...rest, type } as WidgetConfig;
    }
    case "scatter":
      return { ...widget, type: "bubble", r: "tips" };
    case "bubble": {
      const { r: _r, ...rest } = widget;
      return { ...rest, type: "scatter" };
    }
    default:
      return widget;
  }
};
