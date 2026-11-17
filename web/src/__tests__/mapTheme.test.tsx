import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { StyleSpecification } from "maplibre-gl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../api/queryClient";
import {
  arcColors,
  BASEMAP_URL,
  categoryColors,
  classOf,
  divergingColor,
  divergingLegend,
  hexToRgba,
  MAP_ATTRIBUTION,
  mix,
  quantileBreaks,
  quantileColorScale,
  sequentialRamp,
  tuneBasemapStyle,
} from "../map/mapTheme";
import { useMapTheme } from "../map/useMapTheme";
import { ACCENTS, BASE, DIVERGING, SEQUENTIAL } from "../styles/tokens";

const style = (): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#000000" },
    },
    {
      id: "water",
      type: "fill",
      source: "x",
      paint: { "fill-color": "#0000ff" },
    },
    {
      id: "waterway",
      type: "line",
      source: "x",
      paint: { "line-color": "#0000ff" },
    },
    {
      id: "place_label",
      type: "symbol",
      source: "x",
      paint: { "text-color": "#ffffff" },
    },
    {
      id: "road",
      type: "line",
      source: "x",
      paint: { "line-color": "#999999" },
    },
  ],
});

describe("color helpers", () => {
  it("converts and mixes colors", () => {
    expect(hexToRgba("#0ca30c")).toEqual([12, 163, 12, 255]);
    expect(hexToRgba("#0ca30c", 100)).toEqual([12, 163, 12, 100]);
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#123456", "#abcdef", 0)).toBe("#123456");
  });
});

describe("basemap", () => {
  it("uses OpenFreeMap styles and credits the data sources", () => {
    expect(BASEMAP_URL.dark).toContain("tiles.openfreemap.org");
    expect(MAP_ATTRIBUTION).toMatch(/OpenStreetMap/);
    expect(MAP_ATTRIBUTION).toMatch(/NYC TLC/);
  });

  it("recolors background, water and labels without mutating the input", () => {
    const input = style();
    const tuned = tuneBasemapStyle(input, "dark", "ocean");
    const paint = (id: string) =>
      tuned.layers.find((l) => l.id === id)?.paint as Record<string, string>;
    const water = mix(BASE.dark.page, ACCENTS.ocean.dark.accent, 0.18);
    expect(paint("water")["fill-color"]).toBe(water);
    expect(paint("waterway")["line-color"]).toBe(water);
    expect(paint("place_label")["text-color"]).toBe(BASE.dark.muted);
    expect(paint("road")["line-color"]).toBe("#999999"); // untouched
    expect(paint("background")["background-color"]).not.toBe("#000000");
    expect(
      (input.layers[0]?.paint as Record<string, string>)["background-color"],
    ).toBe("#000000");
  });
});

describe("sequential scale", () => {
  it("flips the ramp on dark so low values recede into the surface", () => {
    expect(sequentialRamp("light")[0]).toBe(SEQUENTIAL[0]);
    expect(sequentialRamp("dark")[0]).toBe(SEQUENTIAL.at(-1));
  });

  it("computes quantile classes robust to skew", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
    const breaks = quantileBreaks([...values, null], 4);
    expect(breaks).toHaveLength(3);
    expect(classOf(1, breaks)).toBe(0);
    expect(classOf(1000, breaks)).toBe(3);
    expect(quantileBreaks([null], 4)).toEqual([]);
  });

  it("colors values by class and greys out missing ones", () => {
    const scale = quantileColorScale([10, 20, 30, 40, 50, 60, 70], "light", 7);
    expect(scale.colors).toHaveLength(7);
    expect(scale.colorOf(10)).toEqual(hexToRgba(scale.colors[0] ?? "", 210));
    expect(scale.colorOf(70)).toEqual(hexToRgba(scale.colors[6] ?? "", 210));
    expect(scale.colorOf(null)[3]).toBe(40);
  });
});

describe("diverging scale (red ↔ green by improvement)", () => {
  const green = (c: number[]) => (c[1] ?? 0) > (c[0] ?? 0);
  const red = (c: number[]) => (c[0] ?? 0) > (c[1] ?? 0);

  it("is green when the metric improved and red when it got worse", () => {
    expect(green(divergingColor(20, "higher_is_better", "dark"))).toBe(true);
    expect(red(divergingColor(-20, "higher_is_better", "dark"))).toBe(true);
    // a longer wait is bad even though the number went up
    expect(red(divergingColor(20, "lower_is_better", "dark"))).toBe(true);
    expect(green(divergingColor(-20, "lower_is_better", "dark"))).toBe(true);
  });

  it("grows with the size of the change and is neutral without data", () => {
    const small = divergingColor(3, "higher_is_better", "light");
    const big = divergingColor(60, "higher_is_better", "light");
    expect(big).toEqual(hexToRgba(DIVERGING.better, 215)); // saturates at the pole
    expect(small).not.toEqual(big);
    expect(divergingColor(null, "higher_is_better", "light")).toEqual(
      hexToRgba(DIVERGING.neutral.light, 90),
    );
    expect(divergingLegend("dark")).toEqual([
      DIVERGING.worse,
      expect.any(String),
      DIVERGING.neutral.dark,
      expect.any(String),
      DIVERGING.better,
    ]);
  });
});

describe("categories and arcs", () => {
  it("follow the palette and accents", () => {
    expect(categoryColors("sunset", "light")[0]).toEqual(
      hexToRgba("#eb6834", 220),
    );
    expect(arcColors("neon", "dark")).toEqual({
      source: hexToRgba(ACCENTS.neon.dark.accent, 200),
      target: hexToRgba(ACCENTS.neon.dark.accent2, 200),
    });
  });
});

describe("useMapTheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the basemap of the theme and tunes it to the palette", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(style()))),
    );
    vi.stubGlobal("fetch", fetchMock);
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.palette = "forest";
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMapTheme(), { wrapper });
    await waitFor(() => {
      expect(result.current.style).toBeDefined();
    });
    expect(fetchMock).toHaveBeenCalledWith(BASEMAP_URL.light);
    const water = result.current.style?.layers.find((l) => l.id === "water")
      ?.paint as Record<string, string>;
    expect(water["fill-color"]).toBe(
      mix(BASE.light.page, ACCENTS.forest.light.accent, 0.12),
    );
  });
});
