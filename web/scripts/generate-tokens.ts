/**
 * Writes src/styles/tokens.generated.css from src/styles/tokens.ts.
 *
 *   pnpm --filter @ny-dashboard/web tokens
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { tokensCss } from "../src/styles/tokens";

const target = join(
  import.meta.dirname,
  "..",
  "src",
  "styles",
  "tokens.generated.css",
);
writeFileSync(target, tokensCss());
console.log(`wrote ${target}`);
