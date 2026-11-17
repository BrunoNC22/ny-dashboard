import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

import { cn } from "./cn";

export interface Tab<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

export interface TabsProps<T extends string> {
  label: string;
  value: T;
  tabs: readonly Tab<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** WAI-ARIA tabs: arrow keys move between tabs, only the active panel is rendered. */
export function Tabs<T extends string>({
  label,
  value,
  tabs,
  onChange,
  className,
}: TabsProps<T>) {
  const baseId = useId();
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );
  const active = tabs[index];

  const onKeyDown = (event: KeyboardEvent) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : delta === undefined
            ? null
            : (index + delta + tabs.length) % tabs.length;
    if (target === null) return;
    event.preventDefault();
    const tab = tabs[target];
    if (!tab) return;
    onChange(tab.value);
    tabsRef.current[target]?.focus();
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab, i) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(node) => {
                tabsRef.current[i] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                onChange(tab.value);
              }}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                selected
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.value}`}
          aria-labelledby={`${baseId}-tab-${active.value}`}
          tabIndex={0}
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
