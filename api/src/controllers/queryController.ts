import {
  breakdownRequestSchema,
  kpiRequestSchema,
  mapRequestSchema,
  timeseriesRequestSchema,
} from "@ny-dashboard/shared";
import type { RequestHandler } from "express";

import { validated } from "../middlewares/validate";
import type { BreakdownService } from "../services/breakdownService";
import type { KpiService } from "../services/kpiService";
import type { MapService } from "../services/mapService";
import type { TimeseriesService } from "../services/timeseriesService";

export const querySchemas = {
  timeseries: { body: timeseriesRequestSchema },
  kpi: { body: kpiRequestSchema },
  breakdown: { body: breakdownRequestSchema },
  map: { body: mapRequestSchema },
} as const;

export interface QueryServices {
  timeseries: TimeseriesService;
  kpi: KpiService;
  breakdown: BreakdownService;
  map: MapService;
}

export interface QueryController {
  timeseries: RequestHandler;
  kpi: RequestHandler;
  breakdown: RequestHandler;
  map: RequestHandler;
}

/** Aggregated data queries (public: visitors use the dashboard too). */
export const createQueryController = (
  services: QueryServices,
): QueryController => ({
  async timeseries(_req, res) {
    const { body } = validated(res, querySchemas.timeseries);
    res.json(await services.timeseries.query(body));
  },
  async kpi(_req, res) {
    const { body } = validated(res, querySchemas.kpi);
    res.json(await services.kpi.query(body));
  },
  async breakdown(_req, res) {
    const { body } = validated(res, querySchemas.breakdown);
    res.json(await services.breakdown.query(body));
  },
  async map(_req, res) {
    const { body } = validated(res, querySchemas.map);
    res.json(await services.map.query(body));
  },
});
