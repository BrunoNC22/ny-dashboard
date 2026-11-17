import { formatDeltaPct, type MetricDirection } from "@ny-dashboard/shared";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "../components/ui";

/**
 * Signed change with icon + text (never color alone). Color follows the metric direction:
 * green = better, red = worse (CLAUDE.md §7).
 */
export function DeltaBadge({
  deltaPct,
  direction,
  neutralBandPct = 0,
  className,
}: {
  deltaPct: number | null;
  direction: MetricDirection;
  neutralBandPct?: number;
  className?: string;
}) {
  if (deltaPct === null) {
    return <span className={cn("text-xs text-muted", className)}>—</span>;
  }
  const improved =
    direction === "higher_is_better" ? deltaPct > 0 : deltaPct < 0;
  const neutral = Math.abs(deltaPct) <= neutralBandPct || deltaPct === 0;
  const Icon = neutral ? Minus : deltaPct > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        neutral
          ? "bg-surface-2 text-ink-2"
          : improved
            ? "bg-good/15 text-success-text"
            : "bg-critical/15 text-critical",
        className,
      )}
    >
      <Icon size={12} aria-hidden />
      {formatDeltaPct(deltaPct)}
      <span className="sr-only">
        {neutral ? "(estável)" : improved ? "(melhorou)" : "(piorou)"}
      </span>
    </span>
  );
}
