import {
  preferencesSchema,
  saveDashboardRequestSchema,
} from "@ny-dashboard/shared";
import type { RequestHandler } from "express";

import { requireSession } from "../middlewares/auth";
import { validated } from "../middlewares/validate";
import type {
  DashboardService,
  PreferencesService,
} from "../services/dashboardService";

export const dashboardSchemas = {
  saveDashboard: { body: saveDashboardRequestSchema },
  savePreferences: { body: preferencesSchema },
} as const;

export interface DashboardController {
  getDashboard: RequestHandler;
  saveDashboard: RequestHandler;
  getPreferences: RequestHandler;
  savePreferences: RequestHandler;
}

/** Every handler only touches the dashboard/preferences of the session's user. */
export const createDashboardController = (
  dashboards: DashboardService,
  preferences: PreferencesService,
): DashboardController => ({
  async getDashboard(_req, res) {
    res.json(await dashboards.get(requireSession(res).sub));
  },
  async saveDashboard(_req, res) {
    const { body } = validated(res, dashboardSchemas.saveDashboard);
    res.json(await dashboards.save(requireSession(res).sub, body.state));
  },
  async getPreferences(_req, res) {
    res.json(await preferences.get(requireSession(res).sub));
  },
  async savePreferences(_req, res) {
    const { body } = validated(res, dashboardSchemas.savePreferences);
    res.json(await preferences.save(requireSession(res).sub, body));
  },
});
