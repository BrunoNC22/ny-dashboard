/**
 * Single source of motion (charts, bar waves, line reveals, KPI count-ups): every animation
 * starts fast and ends slow (ease-out) and lasts the same time.
 */
export const ANIMATION_MS = 900;

/** Fast start, slow end. */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/**
 * When the element at `fraction` (0 = first, 1 = last) of a left → right reveal starts, so the
 * reveal as a whole follows easeOutCubic over `span` ms: the inverse of the easing, so early
 * elements enter quickly and the last ones slowly.
 */
export const easeOutStart = (fraction: number, span: number): number =>
  span * (1 - Math.cbrt(1 - Math.min(1, Math.max(0, fraction))));
