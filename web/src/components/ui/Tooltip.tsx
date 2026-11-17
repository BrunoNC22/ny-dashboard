import { type ReactNode, useId, useState } from "react";

import { cn } from "./cn";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/** Shows on hover and keyboard focus; linked with aria-describedby. */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
  };
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === "Escape") hide();
      }}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-lg glass px-2.5 py-1.5 text-xs text-ink shadow-xl",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
