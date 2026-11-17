import { useMemo } from "react";

import { useThemeAttributes } from "../hooks/useThemeAttributes";
import {
  applyChartDefaults,
  type ChartTheme,
  getChartTheme,
} from "./chartTheme";

/**
 * Chart theme for the active <html data-theme/data-palette>. Re-applies the Chart.js defaults
 * when they change; components use the returned object in their options so charts re-render.
 */
export const useChartTheme = (): ChartTheme => {
  const { theme, palette } = useThemeAttributes();
  // Applying the defaults while computing the theme guarantees they are in place before any
  // chart renders with it (and again on every theme/palette change).
  const chartTheme = useMemo(() => {
    const next = getChartTheme(theme, palette);
    applyChartDefaults(next);
    return next;
  }, [theme, palette]);
  return chartTheme;
};
