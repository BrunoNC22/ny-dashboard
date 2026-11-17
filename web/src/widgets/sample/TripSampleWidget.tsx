import { PlaceholderWidget } from "../PlaceholderWidget";
import type { WidgetProps } from "../types";

/** Scatter over the trip sample, loaded on demand. Implemented in #45. */
export function ScatterWidget(props: WidgetProps<"scatter">) {
  return <PlaceholderWidget {...(props as WidgetProps)} />;
}

/** Bubble chart over the trip sample, loaded on demand. Implemented in #45. */
export function BubbleWidget(props: WidgetProps<"bubble">) {
  return <PlaceholderWidget {...(props as WidgetProps)} />;
}
