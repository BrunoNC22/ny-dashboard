import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PALETTES } from "@ny-dashboard/shared";
import { describe, expect, it } from "vitest";

import { contrastRatio } from "../styles/contrast";
import {
  ACCENTS,
  BASE,
  cssVariables,
  HUES,
  PALETTE_ORDERS,
  seriesColors,
  THEME_NAMES,
  tokensCss,
} from "../styles/tokens";

const AA = 4.5;

describe("design tokens", () => {
  it("tokens.generated.css is up to date (run `pnpm --filter @ny-dashboard/web tokens`)", () => {
    const file = readFileSync(
      join(import.meta.dirname, "..", "styles", "tokens.generated.css"),
      "utf8",
    );
    expect(file).toBe(tokensCss());
  });

  it("covers every theme × palette, plus the default", () => {
    const css = tokensCss();
    for (const theme of THEME_NAMES) {
      for (const palette of PALETTES) {
        expect(css).toContain(
          `:root[data-theme="${theme}"][data-palette="${palette}"]`,
        );
      }
    }
    expect(Object.keys(cssVariables("dark", "aurora"))).toContain("series-8");
  });

  it.each(THEME_NAMES)(
    "text tokens reach WCAG AA on the %s surfaces",
    (theme) => {
      const base = BASE[theme];
      for (const background of [base.surface, base.page, base.surface2]) {
        expect(contrastRatio(base.ink, background)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(base.ink2, background)).toBeGreaterThanOrEqual(AA);
        expect(contrastRatio(base.muted, background)).toBeGreaterThanOrEqual(
          AA,
        );
      }
    },
  );

  it.each(PALETTES)(
    "palette %s: text on the accent gradient reaches AA in both themes",
    (palette) => {
      for (const theme of THEME_NAMES) {
        const { accent, accent2, onAccent } = ACCENTS[palette][theme];
        expect(contrastRatio(onAccent, accent)).toBeGreaterThanOrEqual(AA);
        expect(contrastRatio(onAccent, accent2)).toBeGreaterThanOrEqual(AA);
        // the accent is also used as text/focus color on the surface
        expect(
          contrastRatio(accent, BASE[theme].surface),
        ).toBeGreaterThanOrEqual(AA);
      }
    },
  );

  it.each(PALETTES)(
    "palette %s: series are an ordering of the 8 documented hues",
    (palette) => {
      expect([...PALETTE_ORDERS[palette]].sort()).toEqual(
        Object.keys(HUES).sort(),
      );
      for (const theme of THEME_NAMES) {
        const colors = seriesColors(palette, theme);
        expect(new Set(colors).size).toBe(8);
        // dark steps reach 3:1 on the dark surface (light relies on labels/table view: relief rule)
        if (theme === "dark") {
          for (const color of colors)
            expect(
              contrastRatio(color, BASE.dark.surface),
            ).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );
});
