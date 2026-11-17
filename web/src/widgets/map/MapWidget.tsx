import { PlaceholderWidget } from "../PlaceholderWidget";
import type { WidgetProps } from "../types";

/** Map widget (MapLibre + deck.gl), loaded on demand. Implemented in #48/#49. */
export default function MapWidget(props: WidgetProps<"map">) {
  return <PlaceholderWidget {...props} />;
}
