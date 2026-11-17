import { Ban, CircleAlert, Inbox, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Skeleton } from "../components/ui";

export type WidgetStatus =
  "loading" | "error" | "empty" | "not_applicable" | "ready";

export interface WidgetBodyProps {
  status: WidgetStatus;
  onRetry?: () => void;
  /** Overrides the default message of the empty / not applicable states. */
  message?: string;
  /** Skeleton shape while loading. */
  skeleton?: "chart" | "kpi" | "table";
  children?: ReactNode;
}

function Message({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex h-full min-h-20 flex-col items-center justify-center gap-1.5 text-center"
    >
      <span className="text-muted" aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {text !== undefined && (
        <p className="max-w-64 text-xs text-muted">{text}</p>
      )}
      {action}
    </div>
  );
}

/** Body states shared by every widget: loading, error (retry), empty, "não se aplica". */
export function WidgetBody({
  status,
  onRetry,
  message,
  skeleton = "chart",
  children,
}: WidgetBodyProps) {
  switch (status) {
    case "loading":
      return (
        <div
          className="flex h-full flex-col gap-2"
          aria-busy="true"
          aria-label="Carregando"
        >
          {skeleton === "kpi" ? (
            <>
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </>
          ) : skeleton === "table" ? (
            Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-6" />
            ))
          ) : (
            <Skeleton className="min-h-16 flex-1" />
          )}
        </div>
      );
    case "error":
      return (
        <Message
          icon={<CircleAlert size={22} />}
          title="Não foi possível carregar"
          text={message}
          action={
            onRetry && (
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCw size={14} />}
                onClick={onRetry}
                data-no-drag
              >
                Tentar de novo
              </Button>
            )
          }
        />
      );
    case "empty":
      return (
        <Message
          icon={<Inbox size={22} />}
          title="Sem dados"
          text={message ?? "Nenhum dado para os filtros escolhidos."}
        />
      );
    case "not_applicable":
      return (
        <Message
          icon={<Ban size={22} />}
          title="Não se aplica"
          text={message ?? "Esta métrica não existe nos serviços selecionados."}
        />
      );
    case "ready":
      return <>{children}</>;
  }
}
