import { Router } from "express";

import {
  type QueryController,
  querySchemas,
} from "../controllers/queryController";
import { validate } from "../middlewares/validate";

/** /api/query/* (public). */
export const createQueryRouter = (controller: QueryController): Router => {
  const router = Router();
  router.post(
    "/timeseries",
    validate(querySchemas.timeseries),
    controller.timeseries,
  );
  router.post("/kpi", validate(querySchemas.kpi), controller.kpi);
  router.post(
    "/breakdown",
    validate(querySchemas.breakdown),
    controller.breakdown,
  );
  router.post("/map", validate(querySchemas.map), controller.map);
  return router;
};
