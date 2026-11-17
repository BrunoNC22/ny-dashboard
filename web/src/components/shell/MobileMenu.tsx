import { Menu, Moon, Redo2, RotateCcw, Sun, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  selectCanRedo,
  selectCanUndo,
  useDashboardStore,
} from "../../stores/dashboardStore";
import { usePreferencesStore } from "../../stores/preferencesStore";
import { IconButton, Popover } from "../ui";
import { PaletteOptions } from "./appearance";
import { ResetDialog } from "./HistoryActions";
import { SaveIndicator } from "./SaveIndicator";

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-ink transition hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
    >
      <span className="text-ink-2" aria-hidden>
        {icon}
      </span>
      {children}
    </button>
  );
}

/** Mobile header: the actions that do not fit go into one menu. */
export function MobileMenu() {
  const canUndo = useDashboardStore(selectCanUndo);
  const canRedo = useDashboardStore(selectCanRedo);
  const { undo, redo } = useDashboardStore.getState();
  const theme = usePreferencesStore((s) => s.preferences.theme);
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <Popover
        label="Mais ações"
        className="w-64"
        trigger={(props) => (
          <IconButton {...props} label="Mais ações" icon={<Menu size={18} />} />
        )}
      >
        {(close) => (
          <div className="flex flex-col gap-1">
            <SaveIndicator className="px-2.5 py-1.5" />
            <MenuItem
              icon={<Undo2 size={16} />}
              onClick={undo}
              disabled={!canUndo}
            >
              Desfazer
            </MenuItem>
            <MenuItem
              icon={<Redo2 size={16} />}
              onClick={redo}
              disabled={!canRedo}
            >
              Refazer
            </MenuItem>
            <MenuItem
              icon={<RotateCcw size={16} />}
              onClick={() => {
                close();
                setConfirmReset(true);
              }}
            >
              Voltar ao padrão
            </MenuItem>
            <MenuItem
              icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              onClick={toggleTheme}
            >
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </MenuItem>
            <p className="px-2.5 pt-2 text-xs font-medium tracking-wide text-muted uppercase">
              Paleta
            </p>
            <PaletteOptions />
          </div>
        )}
      </Popover>
      <ResetDialog
        open={confirmReset}
        onClose={() => {
          setConfirmReset(false);
        }}
      />
    </>
  );
}
