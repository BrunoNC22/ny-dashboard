import { CircleAlert, CloudCheck, HardDrive } from "lucide-react";

import { useSaveStatus } from "../../stores/useDashboardSync";
import { cn, Spinner } from "../ui";

const STATES = {
  saving: { text: "Salvando…", className: "text-ink-2" },
  saved: { text: "Salvo", className: "text-success-text" },
  error: { text: "Erro ao salvar", className: "text-critical" },
  local: { text: "Salvo neste navegador", className: "text-ink-2" },
} as const;

/** "salvando… / salvo" (CLAUDE.md §6.5); visitors see that the dashboard lives in this browser. */
export function SaveIndicator({ className }: { className?: string }) {
  const status = useSaveStatus((s) => s.status);
  if (status === "idle") return null;
  const { text, className: tone } = STATES[status];
  const icon =
    status === "saving" ? (
      <Spinner size={14} />
    ) : status === "saved" ? (
      <CloudCheck size={16} aria-hidden />
    ) : status === "error" ? (
      <CircleAlert size={16} aria-hidden />
    ) : (
      <HardDrive size={16} aria-hidden />
    );
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      {icon}
      {text}
    </span>
  );
}
