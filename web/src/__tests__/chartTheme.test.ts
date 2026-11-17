import { act, renderHook } from "@testing-library/react";
import { Chart } from "chart.js";
import { describe, expect, it, vi } from "vitest";

import {
  applyChartDefaults,
  areaGradient,
  crosshairPlugin,
  getChartTheme,
  glowPlugin,
  LARGE_SERIES_THRESHOLD,
  largeDataOptions,
  pointStyle,
  seriesColor,
  timeScale,
  withAlpha,
} from "../charts/chartTheme";
import { useChartTheme } from "../charts/useChartTheme";
import { BASE, seriesColors } from "../styles/tokens";

describe("chart theme", () => {
  it("is built from the design tokens", () => {
    const theme = getChartTheme("light", "sunset");
    expect(theme.series).toEqual(seriesColors("sunset", "light"));
    expect(theme.ink).toBe(BASE.light.ink);
    expect(theme.grid).toBe(BASE.light.grid);
    expect(seriesColor(theme, 0)).toBe("#eb6834"); // sunset opens with orange
    expect(seriesColor(theme, 8)).toBe(theme.other); // beyond 8 slots → "Outros"
  });

  it("pairs colors with point shapes in fixed order", () => {
    expect([0, 1, 2, 3].map(pointStyle)).toEqual([
      "circle",
      "rect",
      "triangle",
      "rectRot",
    ]);
  });

  it("converts hex to rgba", () => {
    expect(withAlpha("#0ca30c", 0.5)).toBe("rgba(12, 163, 12, 0.5)");
  });

  it("applies the theme to Chart.defaults (thin marks, recessive axes, ink text)", () => {
    const dark = getChartTheme("dark", "aurora");
    applyChartDefaults(dark);
    expect(Chart.defaults.color).toBe(dark.muted);
    expect(Chart.defaults.font.family).toContain("Inter");
    expect(Chart.defaults.elements.line.borderWidth).toBe(2);
    expect(Chart.defaults.elements.bar.borderRadius).toBe(4);
    expect(Chart.defaults.elements.arc.borderColor).toBe(dark.surface); // 2px surface gap
    expect(Chart.defaults.plugins.tooltip.titleColor).toBe(dark.ink);
    expect(Chart.defaults.plugins.legend.labels.color).toBe(dark.ink2);
    expect(Chart.defaults.scale.grid.color).toBe(dark.grid);

    const light = getChartTheme("light", "ocean");
    applyChartDefaults(light);
    expect(Chart.defaults.color).toBe(light.muted);
    expect(Chart.defaults.scale.grid.color).toBe(light.grid);
  });

  it("creates a vertical area gradient fading to transparent", () => {
    const addColorStop = vi.fn();
    const ctx = { createLinearGradient: vi.fn(() => ({ addColorStop })) };
    const area = {
      top: 10,
      bottom: 210,
      left: 0,
      right: 100,
      width: 100,
      height: 200,
    };
    areaGradient(ctx as unknown as CanvasRenderingContext2D, area, "#2a78d6");
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 10, 0, 210);
    expect(addColorStop).toHaveBeenNthCalledWith(
      1,
      0,
      "rgba(42, 120, 214, 0.35)",
    );
    expect(addColorStop).toHaveBeenNthCalledWith(2, 1, "rgba(42, 120, 214, 0)");
  });

  it("turns on LTTB decimation and turns off animation only for big series", () => {
    expect(largeDataOptions(LARGE_SERIES_THRESHOLD)).toEqual({});
    expect(largeDataOptions(17_520)).toMatchObject({
      animation: false,
      parsing: false,
      plugins: { decimation: { enabled: true, algorithm: "lttb" } },
    });
  });

  it("formats time axes in pt-BR per granularity", () => {
    const scale = timeScale("month");
    expect(scale.time.unit).toBe("month");
    expect(scale.adapters.date.locale.code).toBe("pt-BR");
    expect(scale.time.tooltipFormat).toContain("MMMM");
  });
});

describe("plugins", () => {
  const fakeChart = (
    type: string,
    borderColor: unknown,
    borderDash?: number[],
  ) => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      shadowColor: "",
      shadowBlur: 0,
      shadowOffsetY: 0,
    };
    return {
      chart: { ctx, data: { datasets: [{ borderColor, borderDash }] } },
      args: { meta: { type, index: 0 } },
      ctx,
    };
  };
  type Hook = (chart: unknown, args: unknown) => void;
  const before = (glowPlugin as unknown as { beforeDatasetDraw: Hook })
    .beforeDatasetDraw;
  const after = (glowPlugin as unknown as { afterDatasetDraw: Hook })
    .afterDatasetDraw;

  it("glows solid line strokes in their own color", () => {
    const { chart, args, ctx } = fakeChart("line", "#2a78d6");
    before(chart, args);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.shadowColor).toBe("rgba(42, 120, 214, 0.55)");
    after(chart, args);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("does not glow bars or dashed comparison lines", () => {
    for (const { chart, args, ctx } of [
      fakeChart("bar", "#2a78d6"),
      fakeChart("line", "#2a78d6", [6, 4]),
    ]) {
      before(chart, args);
      after(chart, args);
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.restore).not.toHaveBeenCalled();
    }
  });

  it("draws the crosshair only while hovering", () => {
    const plugin = crosshairPlugin(getChartTheme("dark", "aurora"));
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
    };
    const draw = (
      plugin as unknown as { afterDatasetsDraw: (chart: unknown) => void }
    ).afterDatasetsDraw;
    const chart = (active: unknown[]) => ({
      ctx,
      chartArea: { top: 0, bottom: 100 },
      tooltip: { getActiveElements: () => active },
    });
    draw(chart([]));
    expect(ctx.stroke).not.toHaveBeenCalled();
    draw(chart([{ element: { x: 42 } }]));
    expect(ctx.moveTo).toHaveBeenCalledWith(42, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(42, 100);
  });
});

describe("useChartTheme", () => {
  it("follows <html data-theme data-palette> and reapplies the defaults", async () => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.dataset.palette = "aurora";
    const { result } = renderHook(() => useChartTheme());
    expect(result.current.palette).toBe("aurora");
    expect(Chart.defaults.color).toBe(BASE.dark.muted);

    await act(async () => {
      document.documentElement.dataset.theme = "light";
      document.documentElement.dataset.palette = "forest";
      await Promise.resolve(); // MutationObserver callback
    });
    expect(result.current).toMatchObject({ theme: "light", palette: "forest" });
    expect(Chart.defaults.color).toBe(BASE.light.muted);
  });
});
