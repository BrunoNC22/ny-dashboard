import type {
  BreakdownRequest,
  Credentials,
  DashboardState,
  KpiRequest,
  MapRequest,
  Preferences,
  TimeseriesRequest,
  TripsRequest,
} from "@ny-dashboard/shared";
import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "./client";

/** Stable query keys (objects are hashed structurally by TanStack Query). */
export const queryKeys = {
  me: ["auth", "me"] as const,
  dashboard: ["dashboard"] as const,
  preferences: ["preferences"] as const,
  meta: ["meta"] as const,
  zones: ["zones"] as const,
  timeseries: (request: TimeseriesRequest) =>
    ["query", "timeseries", request] as const,
  kpi: (request: KpiRequest) => ["query", "kpi", request] as const,
  breakdown: (request: BreakdownRequest) =>
    ["query", "breakdown", request] as const,
  map: (request: MapRequest) => ["query", "map", request] as const,
  trips: (request: TripsRequest) => ["query", "trips", request] as const,
};

interface QueryToggle {
  /** Skip the request (e.g. widget not configured or off screen). */
  enabled?: boolean;
}

// ── Session ─────────────────────────────────────────────────────────────────────

/** Current user (null = visitor). */
export const useMe = () =>
  useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.me(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });

const useSessionChange = () => {
  const client = useQueryClient();
  return async () => {
    // A new session: user-specific data must be refetched.
    await client.invalidateQueries({ queryKey: queryKeys.dashboard });
    await client.invalidateQueries({ queryKey: queryKeys.preferences });
  };
};

export const useLogin = () => {
  const client = useQueryClient();
  const onSessionChange = useSessionChange();
  return useMutation({
    mutationFn: (credentials: Credentials) => api.login(credentials),
    onSuccess: async (user) => {
      client.setQueryData(queryKeys.me, user);
      await onSessionChange();
    },
  });
};

export const useRegister = () => {
  const client = useQueryClient();
  const onSessionChange = useSessionChange();
  return useMutation({
    mutationFn: (credentials: Credentials) => api.register(credentials),
    onSuccess: async (user) => {
      client.setQueryData(queryKeys.me, user);
      await onSessionChange();
    },
  });
};

export const useLogout = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      client.setQueryData(queryKeys.me, null);
      client.removeQueries({ queryKey: queryKeys.dashboard });
      client.removeQueries({ queryKey: queryKeys.preferences });
    },
  });
};

// ── Dashboard & preferences (refetched on focus: picks up other devices; §6.5) ───

export const useDashboard = ({ enabled = true }: QueryToggle = {}) =>
  useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => api.getDashboard(signal),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

export const useSaveDashboard = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (state: DashboardState) => api.saveDashboard(state),
    onSuccess: (response) => {
      client.setQueryData(queryKeys.dashboard, response);
    },
  });
};

export const usePreferences = ({ enabled = true }: QueryToggle = {}) =>
  useQuery({
    queryKey: queryKeys.preferences,
    queryFn: ({ signal }) => api.getPreferences(signal),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

export const useSavePreferences = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Preferences) => api.savePreferences(preferences),
    onSuccess: (response) => {
      client.setQueryData(queryKeys.preferences, response);
    },
  });
};

// ── Metadata (immutable between seeds) ──────────────────────────────────────────

export const useMeta = () =>
  useQuery({
    queryKey: queryKeys.meta,
    queryFn: ({ signal }) => api.meta(signal),
    staleTime: Infinity,
  });

export const useZones = ({ enabled = true }: QueryToggle = {}) =>
  useQuery({
    queryKey: queryKeys.zones,
    queryFn: ({ signal }) => api.zones(signal),
    enabled,
    staleTime: Infinity,
  });

// ── Data queries (keep the previous result while filters change) ───────────────

export const useTimeseries = (
  request: TimeseriesRequest,
  { enabled = true }: QueryToggle = {},
) =>
  useQuery({
    queryKey: queryKeys.timeseries(request),
    queryFn: ({ signal }) => api.timeseries(request, signal),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useKpi = (
  request: KpiRequest,
  { enabled = true }: QueryToggle = {},
) =>
  useQuery({
    queryKey: queryKeys.kpi(request),
    queryFn: ({ signal }) => api.kpi(request, signal),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useBreakdown = (
  request: BreakdownRequest,
  { enabled = true }: QueryToggle = {},
) =>
  useQuery({
    queryKey: queryKeys.breakdown(request),
    queryFn: ({ signal }) => api.breakdown(request, signal),
    enabled,
    placeholderData: keepPreviousData,
  });

/** Several breakdowns in parallel (one per table column), each cached on its own. */
export const useBreakdowns = (
  requests: readonly BreakdownRequest[],
  { enabled = true }: QueryToggle = {},
) =>
  useQueries({
    queries: requests.map((request) => ({
      queryKey: queryKeys.breakdown(request),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.breakdown(request, signal),
      enabled,
      placeholderData: keepPreviousData,
    })),
  });

export const useMapQuery = (
  request: MapRequest,
  { enabled = true }: QueryToggle = {},
) =>
  useQuery({
    queryKey: queryKeys.map(request),
    queryFn: ({ signal }) => api.map(request, signal),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useTrips = (
  request: TripsRequest,
  { enabled = true }: QueryToggle = {},
) =>
  useQuery({
    queryKey: queryKeys.trips(request),
    queryFn: ({ signal }) => api.trips(request, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
