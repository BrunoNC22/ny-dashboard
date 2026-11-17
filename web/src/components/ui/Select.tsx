import { ChevronDown } from "lucide-react";
import { type SelectHTMLAttributes, useId } from "react";

import { cn } from "./cn";
import { fieldClasses } from "./Input";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
}

/** Native select (accessible on every device), styled like the inputs. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  id,
  className,
  ...props
}: SelectProps<T>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={selectId}
        className={cn("text-xs font-medium text-ink-2", hideLabel && "sr-only")}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(event) => {
            onChange(event.target.value as T);
          }}
          className={cn(fieldClasses, "appearance-none pr-9")}
          {...props}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
