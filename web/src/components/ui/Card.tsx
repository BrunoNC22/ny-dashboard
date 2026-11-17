import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  icon?: ReactNode;
  /** Actions on the right side of the header. */
  actions?: ReactNode;
  /** Gradient border + glow (highlighted card). */
  highlight?: boolean;
  /** Extra classes for the header (e.g. the grid drag handle). */
  headerClassName?: string;
}

/** Glass card with an optional header (title, icon, actions). */
export function Card({
  title,
  icon,
  actions,
  highlight = false,
  headerClassName,
  className,
  children,
  ...props
}: CardProps) {
  const hasHeader =
    title !== undefined || icon !== undefined || actions !== undefined;
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-card",
        highlight ? "border-gradient glow backdrop-blur-xl" : "glass",
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <header
          className={cn(
            "flex items-center gap-2 px-4 pt-3 pb-2",
            headerClassName,
          )}
        >
          {icon !== undefined && (
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-gradient text-on-accent">
              {icon}
            </span>
          )}
          {title !== undefined && (
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {title}
            </h2>
          )}
          {actions !== undefined && (
            <div className="ml-auto flex items-center gap-1">{actions}</div>
          )}
        </header>
      )}
      <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
    </section>
  );
}
