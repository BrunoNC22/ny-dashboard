import { timeseriesRequestSchema } from "@ny-dashboard/shared";
import type { RequestHandler } from "express";

import { validated } from "../middlewares/validate";
import type { TimeseriesService } from "../services/timeseriesService";

export const querySchemas = {
  timeseries: { body: timeseriesRequestSchema },
} as const;

export interface QueryController {
  timeseries: RequestHandler;
}

/** Aggregated data queries (public: visitors use the dashboard too). */
export const createQueryController = (
  timeseries: TimeseriesService,
): QueryController => ({
  async timeseries(_req, res) {
    const { body } = validated(res, querySchemas.timeseries);
    res.json(await timeseries.query(body));
  },
});
