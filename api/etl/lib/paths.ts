import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** `api/` directory. */
export const API_DIR = join(here, "..", "..");
/** Downloaded raw files (gitignored). */
export const CACHE_DIR = join(API_DIR, "etl", ".cache");
/** Versioned outputs consumed by the seed. */
export const DATA_DIR = join(API_DIR, "data");
export const ZONES_DIR = join(DATA_DIR, "zones");
