import { Info } from "lucide-react";

/** API/widget notes (pt-BR), e.g. why the projection is missing. */
export function WidgetNotices({ notices }: { notices: readonly string[] }) {
  if (notices.length === 0) return null;
  const text = [...new Set(notices)].join(" ");
  return (
    <p
      className="flex items-start gap-1.5 text-[11px] leading-snug text-muted"
      title={text}
    >
      <Info size={12} className="mt-px shrink-0" aria-hidden />
      <span className="line-clamp-2">{text}</span>
    </p>
  );
}
