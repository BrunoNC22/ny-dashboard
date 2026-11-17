import { GripVertical } from "lucide-react";

import { FiltersBar } from "../components/filters/FiltersBar";
import { DashboardGrid } from "../components/grid/DashboardGrid";
import { DRAG_HANDLE_CLASS } from "../components/grid/gridConfig";
import { AppFooter } from "../components/shell/AppFooter";
import { AppHeader } from "../components/shell/AppHeader";
import { useHistoryShortcuts } from "../components/shell/useHistoryShortcuts";
import { Card, Skeleton } from "../components/ui";
import { useDashboardSync } from "../stores/useDashboardSync";

/** The dashboard: shell + grid. Real widgets (#40+) replace the placeholder cards. */
export function DashboardPage() {
  const { ready } = useDashboardSync();
  useHistoryShortcuts();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader filters={<FiltersBar />} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">
        <h1 className="sr-only">Dashboard</h1>
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
      <AppFooter />
    </div>
  );
}
