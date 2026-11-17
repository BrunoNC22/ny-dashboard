import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn, Popover } from "../ui";
import { FilterChip } from "./FilterChip";
import type { Option } from "./useFilterOptions";

export interface MultiSelectFilterProps<T extends string> {
  name: string;
  icon: ReactNode;
  options: readonly Option<T>[];
  /** Empty = all. */
  value: readonly T[];
  onChange: (value: T[]) => void;
  disabled?: boolean;
  /** Shown in the panel (e.g. why the filter is limited). */
  hint?: string;
}

/** Checkbox list in a popover; an empty selection means "Todos". */
export function MultiSelectFilter<T extends string>({
  name,
  icon,
  options,
  value,
  onChange,
  disabled = false,
  hint,
}: MultiSelectFilterProps<T>) {
  const selected = options.filter((option) => value.includes(option.id));
  const summary =
    selected.length === 0
      ? "Todos"
      : selected.length === 1
        ? (selected[0]?.label ?? "")
        : `${String(selected.length)} selecionados`;

  const toggle = (id: T) => {
    const next = value.includes(id)
      ? value.filter((v) => v !== id)
      : options.map((o) => o.id).filter((o) => o === id || value.includes(o));
    // Everything checked is the same as no filter.
    onChange(next.length === options.length ? [] : next);
  };

  return (
    <Popover
      label={name}
      align="start"
      trigger={(props) => (
        <FilterChip
          {...props}
          icon={icon}
          name={name}
          value={summary}
          active={selected.length > 0}
          disabled={disabled}
        />
      )}
    >
      {() => (
        <div className="flex flex-col gap-0.5">
          {hint !== undefined && (
            <p className="px-2.5 pt-1 pb-2 text-xs text-muted">{hint}</p>
          )}
          <button
            type="button"
            aria-pressed={value.length === 0}
            onClick={() => {
              onChange([]);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-2",
              value.length === 0 && "bg-surface-2",
            )}
          >
            <span className="flex-1">Todos</span>
            {value.length === 0 && (
              <Check size={16} className="text-accent" aria-hidden />
            )}
          </button>
          <span className="my-1 h-px bg-border" aria-hidden />
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-ink hover:bg-surface-2"
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--nyd-accent)]"
                checked={value.includes(option.id)}
                onChange={() => {
                  toggle(option.id);
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </Popover>
  );
}
