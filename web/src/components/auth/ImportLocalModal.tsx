import { CloudUpload } from "lucide-react";
import { useState } from "react";

import { useSaveDashboard, useSavePreferences } from "../../api/hooks";
import { useDashboardStore } from "../../stores/dashboardStore";
import {
  clearLocalDashboard,
  loadLocalDashboard,
} from "../../stores/localDashboard";
import {
  clearLocalPreferences,
  loadLocalPreferences,
} from "../../stores/localPreferences";
import { Button, Modal, toast } from "../ui";

export interface ImportLocalModalProps {
  open: boolean;
  /** Called after either choice. */
  onDone: () => void;
}

/**
 * After signing in, offers to replace the account's dashboard (and theme/palette) with the
 * one customized in this browser as a visitor (CLAUDE.md §6.5). Either way the local copy is
 * discarded so the question is not asked again.
 */
export function ImportLocalModal({ open, onDone }: ImportLocalModalProps) {
  const saveDashboard = useSaveDashboard();
  const savePreferences = useSavePreferences();
  const [pending, setPending] = useState(false);

  const keepAccount = () => {
    clearLocalDashboard();
    clearLocalPreferences();
    onDone();
  };

  const importLocal = async () => {
    const dashboard = loadLocalDashboard();
    const preferences = loadLocalPreferences();
    setPending(true);
    try {
      if (dashboard) {
        const saved = await saveDashboard.mutateAsync(dashboard);
        useDashboardStore.getState().hydrate(saved.state);
      }
      if (preferences) await savePreferences.mutateAsync(preferences);
      clearLocalDashboard();
      clearLocalPreferences();
      toast.success("Dashboard deste navegador importado para sua conta.");
      onDone();
    } catch {
      toast.error("Não foi possível importar. Tente de novo.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={keepAccount}
      title="Importar o dashboard deste navegador?"
      description="Você personalizou o dashboard antes de entrar. Quer levar essa versão (layout, widgets, tema e paleta) para a sua conta?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={keepAccount} disabled={pending}>
            Manter o da conta
          </Button>
          <Button
            variant="primary"
            icon={<CloudUpload size={16} />}
            loading={pending}
            onClick={() => {
              void importLocal();
            }}
          >
            Importar
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">
        O dashboard que está na sua conta será substituído.
      </p>
    </Modal>
  );
}
