import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "accent" | "good" | "warning" | "bad";

/** Status tones always carry an icon + label (never color alone). */
const STATUS_ICON: Partial<Record<BadgeTone, ReactNode>> = {
  good: <CircleCheck size={12} aria-hidden />,
  warning: <TriangleAlert size={12} aria-hidden />,
  bad: <CircleAlert size={12} aria-hidden />,
  neutral: <CircleMinus size={12} aria-hidden />,
};

const TONES: Record<BadgeTone, string> = {
  neutral: "border border-border bg-surface-2 text-ink-2",
  accent: "bg-accent-gradient text-on-accent",
  good: "bg-good text-white",
  warning: "bg-warning text-[#0b0b0b]",
  bad: "bg-critical text-white",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  /** Show the status icon (default: true for status tones). */
  withIcon?: boolean;
  className?: string;
}

export function Badge({
  tone = "neutral",
  children,
  withIcon,
  className,
}: BadgeProps) {
  const icon = (withIcon ?? tone !== "accent") ? STATUS_ICON[tone] : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
