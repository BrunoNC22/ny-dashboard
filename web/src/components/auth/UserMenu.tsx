import { createDefaultDashboard } from "@ny-dashboard/shared";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import { Link } from "react-router";

import { useLogout, useMe } from "../../api/hooks";
import { useDashboardStore } from "../../stores/dashboardStore";
import { loadLocalDashboard } from "../../stores/localDashboard";
import { Button, cn, IconButton, toast } from "../ui";

/** Visitor: "Entrar" / "Criar conta"; signed in: avatar + username + "Sair". */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const me = useMe();
  const logout = useLogout();

  if (me.isPending) return <div className="h-10 w-28" aria-hidden />;

  if (!me.data) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink",
          )}
        >
          <LogIn size={16} aria-hidden />
          {!compact && "Entrar"}
          {compact && <span className="sr-only">Entrar</span>}
        </Link>
        {!compact && (
          <Link
            to="/cadastro"
            className="bg-accent-gradient inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-on-accent shadow-lg shadow-accent-glow transition hover:brightness-110"
          >
            <UserPlus size={16} aria-hidden />
            Criar conta
          </Link>
        )}
      </div>
    );
  }

  const signOut = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        // Back to the visitor's own dashboard (or the default one).
        useDashboardStore
          .getState()
          .hydrate(loadLocalDashboard() ?? createDefaultDashboard());
        toast.info("Você saiu da sua conta.");
      },
    });
  };

  const initial = me.data.username.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <span
        className="bg-accent-gradient grid size-9 place-items-center rounded-full text-sm font-semibold text-on-accent"
        aria-hidden
      >
        {initial}
      </span>
      {!compact && (
        <span className="max-w-32 truncate text-sm font-medium text-ink">
          {me.data.username}
        </span>
      )}
      {compact ? (
        <IconButton
          label="Sair"
          icon={<LogOut size={16} />}
          onClick={signOut}
          disabled={logout.isPending}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          icon={<LogOut size={14} />}
          onClick={signOut}
          loading={logout.isPending}
        >
          Sair
        </Button>
      )}
    </div>
  );
}
