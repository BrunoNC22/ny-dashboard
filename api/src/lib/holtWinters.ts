/**
 * Additive Holt-Winters with damped trend (CLAUDE.md §5.8).
 *
 *   ŷ(t+h) = ℓ(t) + (φ + φ² + … + φʰ)·b(t) + s(t + h − m)
 *   ℓ(t) = α·(y(t) − s(t−m)) + (1 − α)·(ℓ(t−1) + φ·b(t−1))
 *   b(t) = β·(ℓ(t) − ℓ(t−1)) + (1 − β)·φ·b(t−1)
 *   s(t) = γ·(y(t) − ℓ(t)) + (1 − γ)·s(t−m)
 *
 * Parameters are chosen by minimizing the one-step-ahead SSE with Nelder-Mead over a sigmoid
 * parameterization (keeps every parameter inside its bounds without constraints).
 */

export interface HoltWintersParams {
  /** Level smoothing (0–1). */
  alpha: number;
  /** Trend smoothing (0–1). */
  beta: number;
  /** Seasonal smoothing (0–1). */
  gamma: number;
  /** Trend damping (0.8–1; 1 = no damping). */
  phi: number;
}

export interface HoltWintersFit {
  params: HoltWintersParams;
  seasonLength: number;
  level: number;
  trend: number;
  /** Seasonal components; `seasonals[(n + k) % m]` belongs to the k-th step after the data. */
  seasonals: number[];
  /** Number of observations used. */
  n: number;
  /** One-step-ahead predictions (same length as the series). */
  fitted: number[];
  /** Sum of squared one-step-ahead errors. */
  sse: number;
}

export interface ForecastOptions {
  /** Clamp forecasts at zero (counts, money, durations). */
  nonNegative?: boolean;
}

const PHI_MIN = 0.8;

const mean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/** Classical initialization from the first two seasons. */
const initialState = (series: number[], m: number) => {
  const first = series.slice(0, m);
  const second = series.slice(m, 2 * m);
  const level = mean(first);
  const trend = (mean(second) - level) / m;
  const seasonals = first.map(
    (value, i) => value - level - trend * (i - (m - 1) / 2),
  );
  return { level, trend, seasonals };
};

/** Runs the smoothing recursions with fixed parameters. Requires at least 2 seasons. */
export const fitWithParams = (
  series: number[],
  seasonLength: number,
  params: HoltWintersParams,
): HoltWintersFit => {
  const m = seasonLength;
  if (series.length < 2 * m) {
    throw new Error(
      `Holt-Winters needs at least ${String(2 * m)} observations`,
    );
  }
  const { alpha, beta, gamma, phi } = params;
  let { level, trend } = initialState(series, m);
  const seasonals = initialState(series, m).seasonals;
  const fitted: number[] = [];
  let sse = 0;

  for (let t = 0; t < series.length; t++) {
    const y = series[t] ?? 0;
    const s = t % m;
    const season = seasonals[s] ?? 0;
    const prediction = level + phi * trend + season;
    fitted.push(prediction);
    sse += (y - prediction) ** 2;

    const previousLevel = level;
    level = alpha * (y - season) + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - previousLevel) + (1 - beta) * phi * trend;
    seasonals[s] = gamma * (y - level) + (1 - gamma) * season;
  }

  return {
    params,
    seasonLength: m,
    level,
    trend,
    seasonals,
    n: series.length,
    fitted,
    sse,
  };
};

/** Forecasts `horizon` steps after the data. */
export const forecast = (
  fit: HoltWintersFit,
  horizon: number,
  { nonNegative = false }: ForecastOptions = {},
): number[] => {
  const { level, trend, seasonals, n, seasonLength: m } = fit;
  const { phi } = fit.params;
  const out: number[] = [];
  let damping = 0;
  for (let k = 1; k <= horizon; k++) {
    damping += phi ** k;
    const value = level + damping * trend + (seasonals[(n + k - 1) % m] ?? 0);
    out.push(nonNegative ? Math.max(0, value) : value);
  }
  return out;
};

// ── Optimization ──────────────────────────────────────────────────────────────

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
const logit = (p: number): number => Math.log(p / (1 - p));

const toParams = ([
  a = 0,
  b = 0,
  g = 0,
  p = 0,
]: number[]): HoltWintersParams => ({
  alpha: sigmoid(a),
  beta: sigmoid(b),
  gamma: sigmoid(g),
  phi: PHI_MIN + (1 - PHI_MIN) * sigmoid(p),
});

/** Minimal Nelder-Mead minimizer. */
export const nelderMead = (
  f: (x: number[]) => number,
  start: number[],
  { step = 1, maxIterations = 300, tolerance = 1e-10 } = {},
): { x: number[]; value: number } => {
  const dims = start.length;
  let simplex = [
    start,
    ...start.map((_, i) => start.map((v, j) => (i === j ? v + step : v))),
  ].map((x) => ({ x, value: f(x) }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    simplex.sort((p, q) => p.value - q.value);
    const best = simplex[0];
    const worst = simplex[dims];
    const secondWorst = simplex[dims - 1];
    if (!best || !worst || !secondWorst) break;
    if (
      Math.abs(worst.value - best.value) <=
      tolerance * (Math.abs(best.value) + tolerance)
    )
      break;

    const centroid = Array.from({ length: dims }, (_, j) =>
      mean(simplex.slice(0, dims).map((point) => point.x[j] ?? 0)),
    );
    const along = (coefficient: number) =>
      centroid.map((c, j) => c + coefficient * ((worst.x[j] ?? 0) - c));
    const evaluate = (x: number[]) => ({ x, value: f(x) });

    const reflected = evaluate(along(-1));
    if (reflected.value < best.value) {
      const expanded = evaluate(along(-2));
      simplex[dims] = expanded.value < reflected.value ? expanded : reflected;
    } else if (reflected.value < secondWorst.value) {
      simplex[dims] = reflected;
    } else {
      const contracted = evaluate(
        along(reflected.value < worst.value ? -0.5 : 0.5),
      );
      if (contracted.value < Math.min(reflected.value, worst.value)) {
        simplex[dims] = contracted;
      } else {
        simplex = simplex.map((point, i) =>
          i === 0
            ? point
            : evaluate(
                point.x.map(
                  (v, j) => (best.x[j] ?? 0) + 0.5 * (v - (best.x[j] ?? 0)),
                ),
              ),
        );
      }
    }
  }
  simplex.sort((p, q) => p.value - q.value);
  const [winner] = simplex;
  if (!winner) throw new Error("Nelder-Mead produced an empty simplex");
  return winner;
};

/** Starting points (α, β, γ, φ) covering slow/fast level and seasonality. */
const STARTS: HoltWintersParams[] = [
  { alpha: 0.3, beta: 0.05, gamma: 0.2, phi: 0.98 },
  { alpha: 0.7, beta: 0.1, gamma: 0.4, phi: 0.95 },
  { alpha: 0.1, beta: 0.01, gamma: 0.1, phi: 0.9 },
];

const toUnconstrained = ({
  alpha,
  beta,
  gamma,
  phi,
}: HoltWintersParams): number[] => [
  logit(alpha),
  logit(beta),
  logit(gamma),
  logit((phi - PHI_MIN) / (1 - PHI_MIN)),
];

/**
 * Fits Holt-Winters choosing the parameters that minimize the one-step-ahead SSE.
 * Series shorter than two seasons cannot be fitted: use `seasonalNaive` instead.
 */
export const fitHoltWinters = (
  series: number[],
  seasonLength = 7,
): HoltWintersFit => {
  const objective = (x: number[]) => {
    const { sse } = fitWithParams(series, seasonLength, toParams(x));
    return Number.isFinite(sse) ? sse : Number.MAX_VALUE;
  };
  let best: { x: number[]; value: number } | undefined;
  for (const start of STARTS) {
    const result = nelderMead(objective, toUnconstrained(start));
    if (!best || result.value < best.value) best = result;
  }
  return fitWithParams(series, seasonLength, toParams(best?.x ?? []));
};

/** Repeats the last season (or the mean, if there is less than one season). */
export const seasonalNaive = (
  series: number[],
  seasonLength: number,
  horizon: number,
  { nonNegative = false }: ForecastOptions = {},
): number[] => {
  if (series.length === 0) return Array.from({ length: horizon }, () => 0);
  const out =
    series.length < seasonLength
      ? Array.from({ length: horizon }, () => mean(series))
      : Array.from(
          { length: horizon },
          (_, k) =>
            series[series.length - seasonLength + (k % seasonLength)] ?? 0,
        );
  return nonNegative ? out.map((v) => Math.max(0, v)) : out;
};

/**
 * Forecasts `horizon` steps: Holt-Winters when there are at least two seasons of data,
 * otherwise the seasonal naive fallback.
 */
export const projectSeries = (
  series: number[],
  horizon: number,
  {
    seasonLength = 7,
    nonNegative = true,
  }: { seasonLength?: number; nonNegative?: boolean } = {},
): number[] =>
  series.length < 2 * seasonLength
    ? seasonalNaive(series, seasonLength, horizon, { nonNegative })
    : forecast(fitHoltWinters(series, seasonLength), horizon, { nonNegative });
