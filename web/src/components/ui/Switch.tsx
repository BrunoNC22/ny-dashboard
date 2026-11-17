import { useId } from "react";

import { cn } from "./cn";

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/** On/off toggle (`role="switch"`), with its label on the left. */
export function Switch({
  label,
  checked,
  onChange,
  description,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <span className="flex flex-col">
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
        {description !== undefined && (
          <span className="text-xs text-muted">{description}</span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full border transition disabled:opacity-40",
          checked
            ? "border-transparent bg-accent-gradient"
            : "border-border-strong bg-surface-2",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all",
            checked ? "left-[1.1rem]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}
