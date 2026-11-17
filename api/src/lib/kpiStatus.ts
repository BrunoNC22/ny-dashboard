import type {
  KpiEvaluation,
  MetricDirection,
  Status,
} from "@ny-dashboard/shared";

const SEVERITY: Readonly<Record<Status, number>> = {
  neutral: 0,
  good: 1,
  warning: 2,
  bad: 3,
};

/** The most severe of the statuses (bad > warning > good > neutral). */
export const worstStatus = (statuses: Status[]): Status =>
  statuses.reduce<Status>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    "neutral",
  );

/**
 * Comparison rule: the change (signed by the direction) of at least `neutralBandPct` is good,
 * a worsening of that size is bad, anything in between is "atenção".
 */
export const statusFromChange = (
  deltaPct: number | null,
  direction: MetricDirection,
  neutralBandPct: number,
): Status => {
  if (deltaPct === null) return "neutral";
  const improvement = direction === "higher_is_better" ? deltaPct : -deltaPct;
  if (improvement >= neutralBandPct) return "good";
  if (improvement <= -neutralBandPct) return "bad";
  return "warning";
};

/**
 * Target rule: reaching the target is good, missing it by up to `warningBandPct` is
 * "atenção", missing by more is bad.
 */
export const statusFromTarget = (
  value: number | null,
  target: number,
  direction: MetricDirection,
  warningBandPct: number,
): Status => {
  if (value === null) return "neutral";
  const tolerance = Math.abs(target) * (warningBandPct / 100);
  if (direction === "higher_is_better") {
    if (value >= target) return "good";
    return value >= target - tolerance ? "warning" : "bad";
  }
  if (value <= target) return "good";
  return value <= target + tolerance ? "warning" : "bad";
};

/** Combined KPI status (CLAUDE.md §6.3): the worst of the enabled rules; neutral if none. */
export const evaluateKpi = (
  value: number | null,
  deltaPct: number | null,
  evaluation: KpiEvaluation,
  defaultDirection: MetricDirection,
): Status => {
  const direction = evaluation.direction ?? defaultDirection;
  const statuses: Status[] = [];
  if (evaluation.comparison.enabled) {
    statuses.push(
      statusFromChange(
        deltaPct,
        direction,
        evaluation.comparison.neutralBandPct,
      ),
    );
  }
  if (evaluation.target) {
    statuses.push(
      statusFromTarget(
        value,
        evaluation.target.value,
        direction,
        evaluation.target.warningBandPct,
      ),
    );
  }
  return worstStatus(statuses);
};
