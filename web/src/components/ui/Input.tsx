import { type InputHTMLAttributes, type ReactNode, useId } from "react";

import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  /** Hide the label visually (still read by screen readers). */
  hideLabel?: boolean;
}

export const fieldClasses =
  "h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-muted transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-glow disabled:opacity-50";

export function Input({
  label,
  hint,
  error,
  hideLabel = false,
  id,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={inputId}
        className={cn("text-xs font-medium text-ink-2", hideLabel && "sr-only")}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          cn(hint !== undefined && hintId, error !== undefined && errorId) ||
          undefined
        }
        className={cn(
          fieldClasses,
          error && "border-critical focus:border-critical",
        )}
        {...props}
      />
      {hint !== undefined && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-critical"
        >
          {error}
        </p>
      )}
    </div>
  );
}
