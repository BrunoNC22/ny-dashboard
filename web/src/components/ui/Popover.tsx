import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "./cn";

export interface PopoverTriggerProps {
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog";
  onClick: () => void;
}

export interface PopoverProps {
  /** Renders the trigger; spread the given props on a button. */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  /** Panel content; `close` lets an item close the popover after acting. */
  children: (close: () => void) => ReactNode;
  label: string;
  align?: "start" | "end";
  className?: string;
}

/**
 * Small glass dropdown panel: toggled by its trigger, closed by Escape (focus returns to the
 * trigger) or by a pointer down outside.
 */
export function Popover({
  trigger,
  children,
  label,
  align = "end",
  className,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      rootRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": "dialog",
        onClick: () => {
          setOpen((value) => !value);
        },
      })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            "glass absolute top-full z-50 mt-2 min-w-56 rounded-2xl border border-border p-2 shadow-xl max-sm:fixed max-sm:inset-x-4 max-sm:w-auto",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
