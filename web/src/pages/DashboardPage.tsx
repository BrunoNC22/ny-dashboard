import { FiltersBar } from "../components/filters/FiltersBar";
import { DashboardGrid } from "../components/grid/DashboardGrid";
import { AppFooter } from "../components/shell/AppFooter";
import { AppHeader } from "../components/shell/AppHeader";
import { useHistoryShortcuts } from "../components/shell/useHistoryShortcuts";
import { Skeleton } from "../components/ui";
import { useDashboardSync } from "../stores/useDashboardSync";
import { WidgetGallery } from "../widgets/WidgetGallery";
import { WidgetRenderer } from "../widgets/WidgetRenderer";

/** The dashboard: shell + grid. Each widget renders through the registry (#40). */
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
            renderWidget={(widget, breakpoint) => (
              <WidgetRenderer widget={widget} breakpoint={breakpoint} />
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
      <WidgetGallery />
    </div>
  );
}
