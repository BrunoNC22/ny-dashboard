import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "./cn";
import { type ToastItem, useToastStore } from "./toastStore";

const ICONS = {
  info: <Info size={16} aria-hidden className="text-accent" />,
  success: <CircleCheck size={16} aria-hidden className="text-good" />,
  error: <CircleAlert size={16} aria-hidden className="text-critical" />,
};

function ToastView({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss);
  useEffect(() => {
    if (item.duration === 0) return;
    const timer = setTimeout(() => {
      dismiss(item.id);
    }, item.duration);
    return () => {
      clearTimeout(timer);
    };
  }, [item, dismiss]);
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex items-start gap-2 rounded-xl glass px-3 py-2.5 text-sm text-ink shadow-xl",
        item.tone === "error" && "border-critical/50",
      )}
    >
      <span className="mt-0.5">{ICONS[item.tone]}</span>
      <p className="min-w-0 flex-1">{item.message}</p>
      <button
        type="button"
        aria-label="Dispensar"
        className="text-muted hover:text-ink"
        onClick={() => {
          dismiss(item.id);
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Renders the toasts (mount once, near the root). */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </div>
  );
}
