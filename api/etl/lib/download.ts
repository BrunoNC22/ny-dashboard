import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { CACHE_DIR } from "./paths";

const exists = async (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * Downloads `url` into the ETL cache (skipped when already cached, unless `refresh`).
 * Returns the local path.
 */
export const downloadToCache = async (
  url: string,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<string> => {
  await mkdir(CACHE_DIR, { recursive: true });
  const target = join(CACHE_DIR, basename(new URL(url).pathname));
  if (!refresh && (await exists(target))) {
    console.log(`cache hit  ${basename(target)}`);
    return target;
  }
  console.log(`download   ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${String(response.status)} ${response.statusText}`,
    );
  }
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  return target;
};
