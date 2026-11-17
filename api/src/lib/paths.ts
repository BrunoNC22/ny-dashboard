import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Finds the `api/` package root by walking up from this file. Works from `src/` (tsx) and from
 * the bundled `dist/` (production image).
 */
export const findApiRoot = (start: string = import.meta.dirname): string => {
  let dir = start;
  for (;;) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      const { name } = JSON.parse(readFileSync(manifest, "utf8")) as {
        name?: string;
      };
      if (name === "@ny-dashboard/api") return dir;
    }
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error(`Could not find the api package root from ${start}`);
    dir = parent;
  }
};

export const API_ROOT = findApiRoot();
export const DATA_DIR = join(API_ROOT, "data");
export const SNAPSHOT_DIR = join(DATA_DIR, "snapshot");
export const ZONES_DIR = join(DATA_DIR, "zones");
