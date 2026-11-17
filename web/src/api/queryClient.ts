import { QueryClient } from "@tanstack/react-query";

/**
 * Data queries are immutable between seeds, so they stay fresh for a while; the dashboard and
 * preferences opt into refetch on window focus (#33) to pick up changes from other devices.
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
