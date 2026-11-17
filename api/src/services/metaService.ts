import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  BOROUGH_LABELS,
  BOROUGHS,
  COMPANY_LABELS,
  DIMENSION_DEFINITIONS,
  DIMENSIONS,
  type MetaResponse,
  metaResponseSchema,
  METRIC_IDS,
  METRICS,
  SERVICE_LABELS,
  SERVICES,
} from "@ny-dashboard/shared";

import { AppError } from "../lib/errors";
import type { DataRepository } from "../models/dataRepository";

export interface MetaService {
  getMeta(): Promise<MetaResponse>;
  getZonesGeoJson(): Promise<{ body: string; etag: string }>;
}

const noData = () =>
  new AppError(
    503,
    "NO_DATA",
    "Os dados ainda não foram carregados (rode o seed)",
  );

/**
 * Metadata and zone geometry. Both only change when the seed runs (which restarts the API in
 * Docker), so they are computed once and cached in memory.
 */
export const createMetaService = (
  data: DataRepository,
  zonesGeoJsonPath: string,
): MetaService => {
  let meta: Promise<MetaResponse> | undefined;
  let zones: Promise<{ body: string; etag: string }> | undefined;

  const buildMeta = async (): Promise<MetaResponse> => {
    const [coverage, zoneRows] = await Promise.all([
      data.getCoverage(),
      data.listZones(),
    ]);
    if (!coverage.firstDate || !coverage.lastDate) throw noData();
    return metaResponseSchema.parse({
      period: { from: coverage.firstDate, to: coverage.lastDate },
      projection: {
        backtestFrom: coverage.backtestFrom,
        until: coverage.projectionUntil,
      },
      sampleMonth: coverage.sampleMonth,
      services: SERVICES.map((id) => ({ id, label: SERVICE_LABELS[id] })),
      companies: coverage.companies.map(({ service, company }) => ({
        id: company,
        label: (COMPANY_LABELS as Record<string, string>)[company] ?? company,
        service,
      })),
      boroughs: BOROUGHS.map((id) => ({ id, label: BOROUGH_LABELS[id] })),
      zones: zoneRows,
      dimensions: DIMENSIONS.map((id) => ({
        id,
        label: DIMENSION_DEFINITIONS[id].label,
        icon: DIMENSION_DEFINITIONS[id].icon,
      })),
      metrics: METRIC_IDS.map((id) => METRICS[id]),
    });
  };

  const loadZones = async () => {
    const body = await readFile(zonesGeoJsonPath, "utf8");
    return { body, etag: `"${createHash("sha1").update(body).digest("hex")}"` };
  };

  return {
    getMeta() {
      meta ??= buildMeta().catch((error: unknown) => {
        meta = undefined; // do not cache failures (e.g. before the seed ran)
        throw error;
      });
      return meta;
    },
    getZonesGeoJson() {
      zones ??= loadZones();
      return zones;
    },
  };
};
