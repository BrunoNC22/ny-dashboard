import {
  kpiRequestSchema,
  timeseriesRequestSchema,
} from "@ny-dashboard/shared";
import type { RequestHandler } from "express";

import { validated } from "../middlewares/validate";
import type { KpiService } from "../services/kpiService";
import type { TimeseriesService } from "../services/timeseriesService";

export const querySchemas = {
  timeseries: { body: timeseriesRequestSchema },
  kpi: { body: kpiRequestSchema },
} as const;

export interface QueryServices {
  timeseries: TimeseriesService;
  kpi: KpiService;
}

export interface QueryController {
  timeseries: RequestHandler;
  kpi: RequestHandler;
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
});
