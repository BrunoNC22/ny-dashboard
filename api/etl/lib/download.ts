import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as sleep } from "node:timers/promises";

import { CACHE_DIR } from "./paths";

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url} failed with HTTP ${String(status)}`);
  }
}

export interface DownloadOptions {
  /** Download again even when the file is already cached. */
  refresh?: boolean;
  /** Retries after the first attempt (default 5). */
  retries?: number;
  /** First backoff delay; doubles on each retry (default 30 s, i.e. 30 s → 8 min). */
  baseDelayMs?: number;
  /** Target directory (default: the ETL cache). */
  dir?: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}

const exists = async (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * Downloads `url` into the ETL cache with a single streamed GET (no parallel range requests,
 * which got us blocked by the TLC CloudFront), retrying with exponential backoff.
 * Writes to `<file>.part` and renames on success. Returns the local path.
 */
export const downloadToCache = async (
  url: string,
  options: DownloadOptions = {},
): Promise<string> => {
  const {
    refresh = false,
    retries = 5,
    baseDelayMs = 30_000,
    dir = CACHE_DIR,
    fetchImpl = fetch,
    log = console.log,
  } = options;

  await mkdir(dir, { recursive: true });
  const target = join(dir, basename(new URL(url).pathname));
  if (!refresh && (await exists(target))) {
    log(`cache hit  ${basename(target)}`);
    return target;
  }

  const part = `${target}.part`;
  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    try {
      log(`download   ${url}`);
      const response = await fetchImpl(url);
      if (!response.ok || !response.body)
        throw new HttpError(url, response.status);
      const expected = Number(
        response.headers.get("content-length") ?? Number.NaN,
      );
      await pipeline(Readable.fromWeb(response.body), createWriteStream(part));
      const { size } = await stat(part);
      if (Number.isFinite(expected) && size !== expected) {
        throw new Error(
          `Incomplete download of ${url}: ${String(size)}/${String(expected)} bytes`,
        );
      }
      await rename(part, target);
      const seconds = (Date.now() - started) / 1000;
      log(
        `downloaded ${basename(target)} (${(size / 1e6).toFixed(1)} MB in ${seconds.toFixed(0)} s)`,
      );
      return target;
    } catch (error) {
      await rm(part, { force: true });
      const notFound = error instanceof HttpError && error.status === 404;
      if (notFound || attempt >= retries) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      log(
        `retry      ${basename(target)} in ${(delay / 1000).toFixed(0)} s (${error instanceof Error ? error.message : String(error)})`,
      );
      await sleep(delay);
    }
  }
};

/** Removes a cached file (no error if it is already gone). */
export const removeFromCache = async (path: string): Promise<void> => {
  await rm(path, { force: true });
};
