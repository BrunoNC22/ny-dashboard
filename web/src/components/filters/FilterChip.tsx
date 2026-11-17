import { ChevronDown } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../ui";

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** Filter name (visible from `sm`, always read by screen readers). */
  name: string;
  value: string;
  /** Highlights a filter that narrows the data. */
  active?: boolean;
}

/** Pill-shaped trigger of a filter popover: icon, name, current value. */
export function FilterChip({
  icon,
  name,
  value,
  active = false,
  className,
  ...props
}: FilterChipProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-2 rounded-full border px-3 text-sm transition disabled:pointer-events-none disabled:opacity-40",
        active
          ? "border-accent/60 bg-accent/10 text-ink shadow-[0_0_16px_-6px_var(--nyd-accent-glow)]"
          : "border-border bg-surface-glass text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <span className={active ? "text-accent" : "text-muted"} aria-hidden>
        {icon}
      </span>
      <span className="sr-only sm:not-sr-only sm:text-muted">{name}:</span>
      {/* Phones hide the filter name, so an unfiltered chip shows the name instead of "Todos". */}
      <span className="truncate font-medium sm:hidden" aria-hidden>
        {active ? value : name}
      </span>
      <span className="sr-only sm:hidden">{value}</span>
      <span className="hidden truncate font-medium sm:inline">{value}</span>
      <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
    </button>
  );
}
