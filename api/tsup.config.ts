import { defineConfig } from "tsup";

/**
 * Production bundle of the API (CLAUDE.md §4): the server and the seed, with the workspace
 * `shared` package and the generated Prisma client inlined. npm dependencies stay external and
 * come from the pruned `pnpm deploy --prod` node_modules in the image.
 */
export default defineConfig({
  entry: { server: "src/server.ts", seed: "src/seed/index.ts" },
  format: "esm",
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: [/^@ny-dashboard\//],
});
