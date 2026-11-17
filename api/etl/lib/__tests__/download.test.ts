import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadToCache, HttpError } from "../download";

const URL_ = "https://example.test/trip-data/green_tripdata_2026-09.parquet";
const okResponse = (body: string) =>
  new Response(body, {
    status: 200,
    headers: { "content-length": String(body.length) },
  });

describe("downloadToCache", () => {
  let dir: string;
  const log = vi.fn();

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "etl-download-"));
    log.mockClear();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("streams the file into the cache and reuses it afterwards", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(okResponse("PAR1data")));
    const path = await downloadToCache(URL_, { dir, fetchImpl, log });
    expect(path).toBe(join(dir, "green_tripdata_2026-09.parquet"));
    expect(await readFile(path, "utf8")).toBe("PAR1data");

    await downloadToCache(URL_, { dir, fetchImpl, log });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "cache hit  green_tripdata_2026-09.parquet",
    );
  });

  it("retries with exponential backoff on HTTP errors (e.g. CloudFront 403)", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("blocked", { status: 403 }))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(okResponse("ok"));
    const path = await downloadToCache(URL_, {
      dir,
      fetchImpl,
      log,
      baseDelayMs: 1,
    });
    expect(await readFile(path, "utf8")).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(
      log.mock.calls.filter(([m]) => String(m).startsWith("retry")),
    ).toHaveLength(2);
  });

  it("does not retry 404 and leaves no partial file", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response("missing", { status: 404 })),
    );
    await expect(
      downloadToCache(URL_, { dir, fetchImpl, log, baseDelayMs: 1 }),
    ).rejects.toThrow(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(
      stat(join(dir, "green_tripdata_2026-09.parquet.part")),
    ).rejects.toThrow();
  });

  it("gives up after the configured retries", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response("blocked", { status: 403 })),
    );
    await expect(
      downloadToCache(URL_, {
        dir,
        fetchImpl,
        log,
        retries: 2,
        baseDelayMs: 1,
      }),
    ).rejects.toThrow(/HTTP 403/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("rejects truncated downloads", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response("short", {
          status: 200,
          headers: { "content-length": "100" },
        }),
      ),
    );
    await expect(
      downloadToCache(URL_, {
        dir,
        fetchImpl,
        log,
        retries: 0,
        baseDelayMs: 1,
      }),
    ).rejects.toThrow(/Incomplete download/);
  });
});
