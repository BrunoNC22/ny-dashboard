import { DATA_COVERAGE, formatIsoDate } from "@ny-dashboard/shared";
import { Database, Map } from "lucide-react";

import { useMeta } from "../../api/hooks";

/** Required attributions (CLAUDE.md §5.1) and the period covered by the data. */
export function AppFooter() {
  const meta = useMeta();
  const period = meta.data?.period ?? DATA_COVERAGE.period;
  return (
    <footer className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="flex items-center gap-1.5">
        <Database size={14} aria-hidden />
        Dados:{" "}
        <a
          href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:text-ink hover:underline"
        >
          NYC Taxi &amp; Limousine Commission
        </a>
        · {formatIsoDate(period.from)} a {formatIsoDate(period.to)}
      </p>
      <p className="flex items-center gap-1.5">
        <Map size={14} aria-hidden />
        Mapa: ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:text-ink hover:underline"
        >
          OpenStreetMap contributors
        </a>
        ,{" "}
        <a
          href="https://openfreemap.org"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:text-ink hover:underline"
        >
          OpenFreeMap
        </a>
      </p>
    </footer>
  );
}
