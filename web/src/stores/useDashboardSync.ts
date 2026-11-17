import { useEffect, useRef } from "react";
import { create } from "zustand";

import { useDashboard, useMe, useSaveDashboard } from "../api/hooks";
import { useDashboardStore } from "./dashboardStore";
import { loadLocalDashboard, saveLocalDashboard } from "./localDashboard";

/** Autosave delay after the last edit (CLAUDE.md §6.5). */
export const AUTOSAVE_DELAY_MS = 800;

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "local";

interface SaveStatusStore {
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
}

/** Status shown by the shell ("salvando… / salvo"). */
export const useSaveStatus = create<SaveStatusStore>((set) => ({
  status: "idle",
  setStatus: (status) => {
    set({ status });
  },
}));

/**
 * Keeps the dashboard store in sync:
 * - visitor: hydrates from localStorage and writes every change back;
 * - logged in: hydrates from the API (also after the focus refetch) unless there are unsaved
 *   local edits, and autosaves 800 ms after the last edit (last write wins).
 * Mount once (the dashboard page).
 */
export function useDashboardSync(): { ready: boolean } {
  const me = useMe();
  const loggedIn = me.data !== null && me.data !== undefined;
  // No session, or the API is unreachable: the dashboard still works locally.
  const visitor = me.data === null || me.isError;
  const server = useDashboard({ enabled: loggedIn });
  const save = useSaveDashboard();
  const revision = useDashboardStore((s) => s.revision);
  const setStatus = useSaveStatus((s) => s.setStatus);
  const lastHydratedRef = useRef<string | null>(null);
  const visitorHydratedRef = useRef(false);

  // Visitor: hydrate once from localStorage.
  useEffect(() => {
    if (!visitor || visitorHydratedRef.current) return;
    visitorHydratedRef.current = true;
    const local = loadLocalDashboard();
    if (local) useDashboardStore.getState().hydrate(local);
    setStatus("local");
  }, [visitor, setStatus]);

  // Logged in: hydrate from the server when it has something newer and we have no pending edits.
  useEffect(() => {
    if (!loggedIn || !server.data) return;
    const { updatedAt, state } = server.data;
    if (lastHydratedRef.current === updatedAt) return;
    if (useDashboardStore.getState().dirty) return;
    lastHydratedRef.current = updatedAt;
    useDashboardStore.getState().hydrate(state);
    setStatus("saved");
  }, [loggedIn, server.data, setStatus]);

  // Persist local edits.
  const mutate = save.mutateAsync;
  useEffect(() => {
    if (revision === 0) return;
    if (!loggedIn) {
      if (visitor) saveLocalDashboard(useDashboardStore.getState().state);
      return;
    }
    const timer = setTimeout(() => {
      const { state, revision: sent } = useDashboardStore.getState();
      setStatus("saving");
      mutate(state)
        .then((response) => {
          lastHydratedRef.current = response.updatedAt;
          useDashboardStore.getState().markSaved(sent);
          setStatus(useDashboardStore.getState().dirty ? "saving" : "saved");
        })
        .catch(() => {
          setStatus("error");
        });
    }, AUTOSAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [revision, loggedIn, visitor, mutate, setStatus]);

  return {
    ready:
      (me.isSuccess || me.isError) &&
      (!loggedIn || server.isSuccess || server.isError),
  };
}
