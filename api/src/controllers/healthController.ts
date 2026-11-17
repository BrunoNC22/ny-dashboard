import type { RequestHandler } from "express";

import { healthView } from "../views/healthView";

export const getHealth: RequestHandler = (_req, res) => {
  res.json(healthView(process.uptime()));
};
