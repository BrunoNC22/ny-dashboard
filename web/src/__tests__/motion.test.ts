import { describe, expect, it } from "vitest";

import { ANIMATION_MS, easeOutCubic, easeOutStart } from "../styles/motion";

describe("motion", () => {
  it("eases out: fast start, slow end", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.5);
  });

  it("schedules a reveal whose progress follows the easing", () => {
    expect(easeOutStart(0, ANIMATION_MS)).toBe(0);
    expect(easeOutStart(1, ANIMATION_MS)).toBe(ANIMATION_MS);
    // half of the items have started well before half of the time
    const half = easeOutStart(0.5, ANIMATION_MS);
    expect(half).toBeLessThan(ANIMATION_MS / 2);
    expect(easeOutCubic(half / ANIMATION_MS)).toBeCloseTo(0.5, 10);
  });
});
