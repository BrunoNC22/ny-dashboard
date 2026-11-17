/**
 * Exports the ETL store (api/etl/.cache/etl.duckdb) to the versioned snapshot in api/data/snapshot.
 *
 *   pnpm --filter @ny-dashboard/api etl:snapshot [--from YYYY-MM] [--to YYYY-MM]
 *
 * Default period: the 24 most recent months in the store.
 */
import { parseArgs } from "node:util";

import { Duck } from "./lib/duckdb";
import { parseMonth } from "./lib/months";
import { SNAPSHOT_DIR } from "./lib/paths";
import { defaultPeriod, exportSnapshot } from "./lib/snapshot";
import { ensureStore, ETL_DB_PATH } from "./lib/store";

const { values } = parseArgs({
  options: { from: { type: "string" }, to: { type: "string" } },
});
const duck = await Duck.open(ETL_DB_PATH);
try {
  await ensureStore(duck);
  const fallback = await defaultPeriod(duck);
  await exportSnapshot(duck, {
    dir: SNAPSHOT_DIR,
    period: {
      from: values.from ? parseMonth(values.from) : fallback.from,
      to: values.to ? parseMonth(values.to) : fallback.to,
    },
  });
} finally {
  duck.close();
}
