import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COUNT_UP_MS, useCountUp } from "../hooks/useCountUp";

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("useCountUp", () => {
  it("counts up from zero to a positive value", () => {
    const { result } = renderHook(() => useCountUp(869));
    expect(result.current).toBe(0);
    advance(COUNT_UP_MS / 3);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(869);
    advance(COUNT_UP_MS);
    expect(result.current).toBe(869);
  });

  it("counts down from zero to a negative value", () => {
    const { result } = renderHook(() => useCountUp(-6.2));
    advance(COUNT_UP_MS / 3);
    expect(result.current).toBeLessThan(0);
    expect(result.current).toBeGreaterThan(-6.2);
    advance(COUNT_UP_MS);
    expect(result.current).toBe(-6.2);
  });

  it("animates from the current value when the target changes", () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), {
      initialProps: { v: 100 },
    });
    advance(COUNT_UP_MS * 2);
    rerender({ v: 200 });
    advance(COUNT_UP_MS / 3);
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThan(200);
    advance(COUNT_UP_MS);
    expect(result.current).toBe(200);
  });

  it("never overshoots below zero when the frame time precedes the start", () => {
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementationOnce((callback) => {
        callback(performance.now() - 50); // frame started before the effect ran
        return 1;
      });
    const { result } = renderHook(() => useCountUp(869));
    expect(result.current).toBe(0);
    raf.mockRestore();
  });

  it("is null without a value", () => {
    const { result } = renderHook(() => useCountUp(null));
    expect(result.current).toBeNull();
  });
});
