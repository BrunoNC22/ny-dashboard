import { type KeyboardEvent, type ReactNode, useRef } from "react";

import { cn } from "./cn";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly Segment<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Show only the icons (labels stay accessible). */
  iconOnly?: boolean;
  className?: string;
}

/** Radio group styled as a pill switch; arrow keys move the selection. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  iconOnly = false,
  className,
}: SegmentedControlProps<T>) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const onKeyDown = (event: KeyboardEvent) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (delta === undefined) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex rounded-xl border border-border bg-surface-2 p-1",
        className,
      )}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonsRef.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              selected
                ? "bg-accent-gradient text-on-accent shadow"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {option.icon}
            {!iconOnly && option.label}
          </button>
        );
      })}
    </div>
  );
}
