import { Redo2, RotateCcw, Undo2 } from "lucide-react";
import { useState } from "react";

import {
  selectCanRedo,
  selectCanUndo,
  useDashboardStore,
} from "../../stores/dashboardStore";
import { Button, IconButton, Modal, toast } from "../ui";

/** "Voltar ao padrão" confirmation (undoable, but it replaces the whole dashboard). */
export function ResetDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const resetToDefault = useDashboardStore((s) => s.resetToDefault);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Voltar ao dashboard padrão?"
      description="Widgets, layouts e filtros voltam ao modelo inicial. Dá para desfazer com Ctrl+Z."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            icon={<RotateCcw size={16} />}
            onClick={() => {
              resetToDefault();
              onClose();
              toast.info("Dashboard restaurado ao padrão.");
            }}
          >
            Voltar ao padrão
          </Button>
        </>
      }
    />
  );
}

/** Undo / redo / reset icon buttons (desktop header). */
export function HistoryActions() {
  const canUndo = useDashboardStore(selectCanUndo);
  const canRedo = useDashboardStore(selectCanRedo);
  const undo = useDashboardStore((s) => s.undo);
  const redo = useDashboardStore((s) => s.redo);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        label="Desfazer (Ctrl+Z)"
        icon={<Undo2 size={18} />}
        onClick={undo}
        disabled={!canUndo}
      />
      <IconButton
        label="Refazer (Ctrl+Shift+Z)"
        icon={<Redo2 size={18} />}
        onClick={redo}
        disabled={!canRedo}
      />
      <IconButton
        label="Voltar ao padrão"
        icon={<RotateCcw size={18} />}
        onClick={() => {
          setConfirmReset(true);
        }}
      />
      <ResetDialog
        open={confirmReset}
        onClose={() => {
          setConfirmReset(false);
        }}
      />
    </div>
  );
}
