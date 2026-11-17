import { GripVertical } from "lucide-react";

import { DashboardGrid } from "../components/grid/DashboardGrid";
import { DRAG_HANDLE_CLASS } from "../components/grid/gridConfig";
import { Card, Skeleton } from "../components/ui";
import { useDashboardSync } from "../stores/useDashboardSync";

/** The dashboard. Header/shell (#37) and real widgets (#40+) plug in here. */
export function DashboardPage() {
  const { ready } = useDashboardSync();
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6">
      {ready ? (
        <DashboardGrid
          renderWidget={(widget) => (
            <Card
              className="flex-1"
              headerClassName={DRAG_HANDLE_CLASS}
              title={widget.title}
              icon={<GripVertical size={14} />}
            >
              <p className="text-xs text-muted">{widget.type}</p>
            </Card>
          )}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      )}
    </main>
  );
}
