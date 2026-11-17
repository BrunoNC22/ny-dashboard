import {
  SERVICES,
  TRIP_FIELDS_CATALOG,
  type TripsRequest,
  type TripsResponse,
} from "@ny-dashboard/shared";

import type { QueryRepository } from "../models/queryRepository";
import { toCategories } from "./mapService";

export interface TripsService {
  query(request: TripsRequest): Promise<TripsResponse>;
}

/**
 * Trip sample values for scatter/bubble charts. Every matching point is returned (no
 * downsampling: CLAUDE.md §8). Services without one of the requested fields (e.g. wait time
 * outside FHVHV) are left out.
 */
export const createTripsService = (repo: QueryRepository): TripsService => ({
  async query({ x, y, r, colorBy, filters, hours }) {
    const fields = [x, y, ...(r ? [r] : [])].map(
      (field) => TRIP_FIELDS_CATALOG[field],
    );
    const selected =
      filters.services.length > 0 ? filters.services : [...SERVICES];
    const services = selected.filter((service) =>
      fields.every((field) => field.services.includes(service)),
    );
    if (services.length === 0) {
      return {
        categories: [],
        columns: { x: [], y: [], r: r ? [] : null, category: [] },
      };
    }
    const trips = await repo.sampleTrips({
      range: filters.period,
      filters: {
        services,
        companies: filters.companies,
        boroughs: filters.boroughs,
        zones: filters.zones,
      },
      x: TRIP_FIELDS_CATALOG[x].column,
      y: TRIP_FIELDS_CATALOG[y].column,
      ...(r ? { r: TRIP_FIELDS_CATALOG[r].column } : {}),
      colorBy,
      ...(hours ? { hours } : {}),
    });
    const { categories, index } = toCategories(trips.category);
    return {
      categories,
      columns: { x: trips.x, y: trips.y, r: trips.r, category: index },
    };
  },
});
