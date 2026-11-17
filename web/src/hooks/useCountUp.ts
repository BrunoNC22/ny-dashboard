import { useEffect, useRef, useState } from "react";

import { ANIMATION_MS, easeOutCubic } from "../styles/motion";

/** Same duration and easing as every other animation (styles/motion.ts). */
export const COUNT_UP_MS = ANIMATION_MS;

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animated number: counts from 0 to `target` on first show (down to it when negative), and from
 * the current value to the new target when it changes. Immediate with reduced motion.
 */
export function useCountUp(
  target: number | null,
  duration = COUNT_UP_MS,
): number | null {
  const [value, setValue] = useState<number | null>(() =>
    target === null ? null : prefersReducedMotion() ? target : 0,
  );
  const currentRef = useRef(0);

  useEffect(() => {
    if (target === null) return;
    const instant = prefersReducedMotion() || duration <= 0;
    const from = currentRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // rAF timestamps are the frame start and can precede `start`: clamp to [0, 1], or the
      // easing overshoots below zero (a count up to 869 briefly showed −87).
      const progress = instant
        ? 1
        : Math.min(1, Math.max(0, (now - start) / duration));
      const next = from + (target - from) * easeOutCubic(progress);
      currentRef.current = next;
      setValue(next);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  return target === null ? null : value;
}
