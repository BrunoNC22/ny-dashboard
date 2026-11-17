import {
  apiErrorSchema,
  type BreakdownRequest,
  type BreakdownResponse,
  breakdownResponseSchema,
  type Credentials,
  type DashboardResponse,
  dashboardResponseSchema,
  type DashboardState,
  type KpiRequest,
  type KpiResponse,
  kpiResponseSchema,
  type MapRequest,
  type MapResponse,
  type MetaResponse,
  metaResponseSchema,
  type Preferences,
  type PreferencesResponse,
  preferencesResponseSchema,
  type PublicUser,
  publicUserSchema,
  type TimeseriesRequest,
  type TimeseriesResponse,
  timeseriesResponseSchema,
  type TripsRequest,
  type TripsResponse,
} from "@ny-dashboard/shared";
import { z } from "zod";

/** API error with the standard body `{ error: { code, message, details } }`. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export const isApiError = (
  error: unknown,
  code?: string,
): error is ApiRequestError =>
  error instanceof ApiRequestError &&
  (code === undefined || error.code === code);

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  /** Validates the response (skipped for very large payloads). */
  schema?: z.ZodType<T>;
  signal?: AbortSignal | undefined;
}

/**
 * fetch wrapper: same-origin cookie session, JSON in/out, standard errors. Network failures
 * become `ApiRequestError(0, "NETWORK_ERROR")`.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const { method = "GET", body, schema, signal } = options;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers:
        body === undefined
          ? { Accept: "application/json" }
          : { "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiRequestError(0, "NETWORK_ERROR", "Sem conexão com o servidor");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiRequestError(response.status, code, message, details);
    }
    throw new ApiRequestError(
      response.status,
      "HTTP_ERROR",
      `Erro ${String(response.status)}`,
    );
  }
  return schema ? schema.parse(data) : (data as T);
}

const userResponse = z.object({ user: publicUserSchema });

/** GeoJSON of the taxi zones (GET /api/zones). */
export interface ZoneFeature {
  type: "Feature";
  id: number;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
  properties: {
    locationId: number;
    zone: string;
    borough: string;
    boroughId: string;
    serviceZone: string;
    centroid: [number, number];
  };
}
export interface ZonesGeoJson {
  type: "FeatureCollection";
  features: ZoneFeature[];
}

/** Typed API endpoints (CLAUDE.md §9). */
export const api = {
  // auth
  /** Current user, or null for visitors (401). */
  async me(signal?: AbortSignal): Promise<PublicUser | null> {
    try {
      return (await apiFetch("/api/auth/me", { schema: userResponse, signal }))
        .user;
    } catch (error) {
      if (isApiError(error) && error.status === 401) return null;
      throw error;
    }
  },
  login: async (credentials: Credentials) =>
    (
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: credentials,
        schema: userResponse,
      })
    ).user,
  register: async (credentials: Credentials) =>
    (
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: credentials,
        schema: userResponse,
      })
    ).user,
  logout: () => apiFetch<undefined>("/api/auth/logout", { method: "POST" }),

  // dashboard & preferences
  getDashboard: (signal?: AbortSignal) =>
    apiFetch<DashboardResponse>("/api/dashboard", {
      schema: dashboardResponseSchema,
      signal,
    }),
  saveDashboard: (state: DashboardState) =>
    apiFetch<DashboardResponse>("/api/dashboard", {
      method: "PUT",
      body: { state },
      schema: dashboardResponseSchema,
    }),
  getPreferences: (signal?: AbortSignal) =>
    apiFetch<PreferencesResponse>("/api/preferences", {
      schema: preferencesResponseSchema,
      signal,
    }),
  savePreferences: (preferences: Preferences) =>
    apiFetch<PreferencesResponse>("/api/preferences", {
      method: "PUT",
      body: preferences,
      schema: preferencesResponseSchema,
    }),

  // metadata
  meta: (signal?: AbortSignal) =>
    apiFetch<MetaResponse>("/api/meta", { schema: metaResponseSchema, signal }),
  zones: (signal?: AbortSignal) =>
    apiFetch<ZonesGeoJson>("/api/zones", { signal }),

  // queries
  timeseries: (request: TimeseriesRequest, signal?: AbortSignal) =>
    apiFetch<TimeseriesResponse>("/api/query/timeseries", {
      method: "POST",
      body: request,
      schema: timeseriesResponseSchema,
      signal,
    }),
  kpi: (request: KpiRequest, signal?: AbortSignal) =>
    apiFetch<KpiResponse>("/api/query/kpi", {
      method: "POST",
      body: request,
      schema: kpiResponseSchema,
      signal,
    }),
  breakdown: (request: BreakdownRequest, signal?: AbortSignal) =>
    apiFetch<BreakdownResponse>("/api/query/breakdown", {
      method: "POST",
      body: request,
      schema: breakdownResponseSchema,
      signal,
    }),
  /** Not validated: `points` can carry ~1M coordinates. */
  map: (request: MapRequest, signal?: AbortSignal) =>
    apiFetch<MapResponse>("/api/query/map", {
      method: "POST",
      body: request,
      signal,
    }),
  /** Not validated: up to ~1M points (CLAUDE.md §8). */
  trips: (request: TripsRequest, signal?: AbortSignal) =>
    apiFetch<TripsResponse>("/api/query/trips", {
      method: "POST",
      body: request,
      signal,
    }),
};
