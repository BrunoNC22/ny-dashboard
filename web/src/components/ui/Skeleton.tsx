import { cn } from "./cn";

/** Shimmering placeholder while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--nyd-surface-2)_25%,var(--nyd-border-strong)_50%,var(--nyd-surface-2)_75%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
