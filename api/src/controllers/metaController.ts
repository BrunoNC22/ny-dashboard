import type { RequestHandler } from "express";

import type { MetaService } from "../services/metaService";

export interface MetaController {
  getMeta: RequestHandler;
  getZones: RequestHandler;
}

/** Zones change only with a new snapshot: cache for a day, revalidate with the ETag. */
const ZONES_CACHE_CONTROL = "public, max-age=86400, must-revalidate";

export const createMetaController = (meta: MetaService): MetaController => ({
  async getMeta(_req, res) {
    res.set("Cache-Control", "no-cache");
    res.json(await meta.getMeta());
  },
  async getZones(req, res) {
    const { body, etag } = await meta.getZonesGeoJson();
    res.set({ ETag: etag, "Cache-Control": ZONES_CACHE_CONTROL });
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }
    res.type("application/geo+json").send(body);
  },
});
