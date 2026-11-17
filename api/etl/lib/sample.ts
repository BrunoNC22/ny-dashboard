import type { Service } from "@ny-dashboard/shared";

/**
 * Splits `total` sample rows among services: each service first gets `floor` rows (or all of
 * its rows if it has fewer), the rest is shared proportionally to the remaining availability.
 * If there are not enough rows overall, everything is taken.
 */
export const computeQuotas = (
  available: Partial<Record<Service, number>>,
  total: number,
  floor: number,
): Partial<Record<Service, number>> => {
  const entries = Object.entries(available) as [Service, number][];
  const sumAvailable = entries.reduce((sum, [, n]) => sum + n, 0);
  if (sumAvailable <= total) return Object.fromEntries(entries);

  const base = Object.fromEntries(
    entries.map(([s, n]) => [s, Math.min(floor, n)]),
  ) as Record<Service, number>;
  const remaining = total - Object.values(base).reduce((sum, n) => sum + n, 0);
  const rest = entries.map(([s, n]) => [s, n - base[s]] as const);
  const sumRest = rest.reduce((sum, [, n]) => sum + n, 0);

  const quotas = Object.fromEntries(
    rest.map(([s, n]) => [
      s,
      base[s] + (sumRest > 0 ? Math.floor((remaining * n) / sumRest) : 0),
    ]),
  ) as Record<Service, number>;

  // Hand out the rounding leftovers to the largest services (deterministic order).
  let leftover = total - Object.values(quotas).reduce((sum, n) => sum + n, 0);
  for (const [s] of [...rest].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )) {
    if (leftover <= 0) break;
    if (quotas[s] < (available[s] ?? 0)) {
      quotas[s] += 1;
      leftover -= 1;
    }
  }
  return quotas;
};
