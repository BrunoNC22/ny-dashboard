import { describe, expect, it } from "vitest";

import {
  fitHoltWinters,
  fitWithParams,
  forecast,
  nelderMead,
  projectSeries,
  seasonalNaive,
} from "../lib/holtWinters";

/** Deterministic pseudo-random noise in [-1, 1]. */
const noise = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return (state / 2147483648) * 2 - 1;
  };
};

/** Daily series with linear trend + weekly seasonality (+ optional noise). */
const synthetic = (length: number, { noiseLevel = 0, seed = 1 } = {}) => {
  const random = noise(seed);
  const weekly = [10, 12, 15, 18, 30, 25, -5]; // e.g. Friday/Saturday peaks
  return Array.from(
    { length },
    (_, t) => 1000 + 2 * t + (weekly[t % 7] ?? 0) * 5 + noiseLevel * random(),
  );
};

const mape = (actual: number[], predicted: number[]) =>
  (100 / actual.length) *
  actual.reduce(
    (sum, value, i) => sum + Math.abs((value - (predicted[i] ?? 0)) / value),
    0,
  );

describe("nelderMead", () => {
  it("minimizes a smooth function", () => {
    const { x, value } = nelderMead(
      ([a = 0, b = 0]) => (a - 3) ** 2 + (b + 1) ** 2,
      [0, 0],
    );
    expect(x[0]).toBeCloseTo(3, 3);
    expect(x[1]).toBeCloseTo(-1, 3);
    expect(value).toBeLessThan(1e-6);
  });
});

describe("Holt-Winters", () => {
  it("forecasts trend + weekly seasonality accurately", () => {
    const series = synthetic(210, { noiseLevel: 20 });
    const train = series.slice(0, 182);
    const test = series.slice(182);
    const predicted = forecast(fitHoltWinters(train), test.length);
    expect(mape(test, predicted)).toBeLessThan(3);
  });

  it("beats the seasonal naive baseline on trended data", () => {
    const series = synthetic(140, { noiseLevel: 10, seed: 7 });
    const train = series.slice(0, 112);
    const test = series.slice(112);
    const hw = mape(test, forecast(fitHoltWinters(train), test.length));
    const naive = mape(test, seasonalNaive(train, 7, test.length));
    expect(hw).toBeLessThan(naive);
  });

  it("keeps the optimized parameters inside their bounds", () => {
    const { params } = fitHoltWinters(synthetic(120, { noiseLevel: 15 }));
    for (const key of ["alpha", "beta", "gamma"] as const) {
      expect(params[key]).toBeGreaterThan(0);
      expect(params[key]).toBeLessThan(1);
    }
    expect(params.phi).toBeGreaterThanOrEqual(0.8);
    expect(params.phi).toBeLessThanOrEqual(1);
  });

  it("forecasts a constant series as constant", () => {
    const predicted = forecast(
      fitHoltWinters(Array.from({ length: 56 }, () => 42)),
      10,
    );
    for (const value of predicted) expect(value).toBeCloseTo(42, 6);
  });

  it("aligns the seasonal pattern with the forecast steps", () => {
    const series = synthetic(70); // no noise
    const fit = fitWithParams(series, 7, {
      alpha: 0.5,
      beta: 0.1,
      gamma: 0.5,
      phi: 1,
    });
    const predicted = forecast(fit, 7);
    const expected = synthetic(77).slice(70);
    for (const [i, value] of predicted.entries())
      expect(value).toBeCloseTo(expected[i] ?? 0, 0);
    expect(fit.fitted).toHaveLength(70);
  });

  it("is deterministic", () => {
    const series = synthetic(100, { noiseLevel: 30, seed: 3 });
    expect(forecast(fitHoltWinters(series), 14)).toEqual(
      forecast(fitHoltWinters(series), 14),
    );
  });

  it("refuses series shorter than two seasons", () => {
    expect(() =>
      fitWithParams([1, 2, 3], 7, {
        alpha: 0.5,
        beta: 0.1,
        gamma: 0.1,
        phi: 1,
      }),
    ).toThrow(/at least 14/);
  });
});

describe("projectSeries", () => {
  it("uses Holt-Winters with enough data and clamps negative values", () => {
    const falling = Array.from({ length: 28 }, (_, t) => 100 - 4 * t);
    const predicted = projectSeries(falling, 14);
    expect(predicted).toHaveLength(14);
    expect(Math.min(...predicted)).toBeGreaterThanOrEqual(0);
  });

  it("falls back to seasonal naive for short series", () => {
    expect(projectSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 9)).toEqual([
      4, 5, 6, 7, 8, 9, 10, 4, 5,
    ]);
    expect(projectSeries([2, 4], 3)).toEqual([3, 3, 3]);
    expect(projectSeries([], 2)).toEqual([0, 0]);
  });
});
