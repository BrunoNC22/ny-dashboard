import type { Palette, Theme } from "@ny-dashboard/shared";
import { useQuery } from "@tanstack/react-query";
import type { StyleSpecification } from "maplibre-gl";
import { useMemo } from "react";

import { useThemeAttributes } from "../hooks/useThemeAttributes";
import { BASEMAP_URL, tuneBasemapStyle } from "./mapTheme";

const fetchStyle = async (theme: Theme): Promise<StyleSpecification> => {
  const response = await fetch(BASEMAP_URL[theme]);
  if (!response.ok)
    throw new Error(`Basemap style failed: ${String(response.status)}`);
  return (await response.json()) as StyleSpecification;
};

export interface MapTheme {
  theme: Theme;
  palette: Palette;
  /** Tuned basemap style (undefined while loading or if the basemap is unreachable). */
  style: StyleSpecification | undefined;
  styleError: boolean;
}

/** Basemap + palette for the active <html data-theme data-palette>. */
export const useMapTheme = (): MapTheme => {
  const { theme, palette } = useThemeAttributes();
  const query = useQuery({
    queryKey: ["basemap-style", theme],
    queryFn: () => fetchStyle(theme),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  const style = useMemo(
    () =>
      query.data ? tuneBasemapStyle(query.data, theme, palette) : undefined,
    [query.data, theme, palette],
  );
  return { theme, palette, style, styleError: query.isError };
};
