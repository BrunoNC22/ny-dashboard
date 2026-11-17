import { DEFAULT_PREFERENCES } from "@ny-dashboard/shared";
import { useEffect, useRef } from "react";

import { useMe, usePreferences, useSavePreferences } from "../api/hooks";
import { loadLocalPreferences, saveLocalPreferences } from "./localPreferences";
import { usePreferencesStore } from "./preferencesStore";

/** Short debounce so clicking through palettes sends one request. */
export const PREFERENCES_SAVE_DELAY_MS = 300;

/**
 * Keeps theme/palette in sync (CLAUDE.md §6.5): account preferences when signed in (also after
 * the focus refetch, unless a change is pending), localStorage for visitors. Mount once, at the
 * root, so every page (login included) follows them.
 */
export function usePreferencesSync(): void {
  const me = useMe();
  const loggedIn = me.data !== null && me.data !== undefined;
  const visitor = me.data === null || me.isError;
  const server = usePreferences({ enabled: loggedIn });
  const save = useSavePreferences();
  const revision = usePreferencesStore((s) => s.revision);
  const lastHydratedRef = useRef<string | null>(null);

  // Visitor (initially or after signing out): the browser's own preferences.
  useEffect(() => {
    if (!visitor) return;
    lastHydratedRef.current = null;
    usePreferencesStore
      .getState()
      .hydrate(loadLocalPreferences() ?? DEFAULT_PREFERENCES);
  }, [visitor]);

  // Signed in: the account's preferences.
  useEffect(() => {
    if (!loggedIn || !server.data) return;
    const { updatedAt, preferences } = server.data;
    if (lastHydratedRef.current === updatedAt) return;
    if (usePreferencesStore.getState().dirty) return;
    lastHydratedRef.current = updatedAt;
    usePreferencesStore.getState().hydrate(preferences);
  }, [loggedIn, server.data]);

  // Persist user changes.
  const mutate = save.mutateAsync;
  useEffect(() => {
    if (revision === 0) return;
    const { preferences } = usePreferencesStore.getState();
    if (!loggedIn) {
      if (visitor) {
        saveLocalPreferences(preferences);
        usePreferencesStore.getState().markSaved(revision);
      }
      return;
    }
    const timer = setTimeout(() => {
      const current = usePreferencesStore.getState();
      mutate(current.preferences)
        .then((response) => {
          lastHydratedRef.current = response.updatedAt;
          usePreferencesStore.getState().markSaved(current.revision);
        })
        .catch(() => {
          // keep the local choice; the next change retries
        });
    }, PREFERENCES_SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [revision, loggedIn, visitor, mutate]);
}
