import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (required: there is no visible text). */
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "secondary" | "primary";
  size?: "sm" | "md";
}

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl transition disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "size-8" : "size-10",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "secondary" && "glass text-ink hover:bg-surface-2",
        variant === "primary" &&
          "bg-accent-gradient text-on-accent hover:brightness-110",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
