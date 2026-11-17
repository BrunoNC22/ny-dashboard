import { Hammer } from "lucide-react";

import type { WidgetProps } from "./types";

/** Body of the widget types not implemented yet (replaced type by type in #43–#49). */
export function PlaceholderWidget({ widget }: WidgetProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-muted">
      <Hammer size={20} aria-hidden />
      <p className="text-xs">Widget “{widget.type}” em construção</p>
    </div>
  );
}
