import type { Credentials } from "@ny-dashboard/shared";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useLogin, useRegister } from "../../api/hooks";
import { isCustomized, loadLocalDashboard } from "../../stores/localDashboard";
import { loadLocalPreferences } from "../../stores/localPreferences";
import type { AuthMode } from "./AuthForm";

/** True if this browser has visitor customizations worth importing into the account. */
export const hasLocalCustomizations = (): boolean => {
  const dashboard = loadLocalDashboard();
  return (
    (dashboard !== null && isCustomized(dashboard)) ||
    loadLocalPreferences() !== null
  );
};

/** Submits login/sign-up, then either asks to import the local dashboard or goes home. */
export const useAuthFlow = (mode: AuthMode) => {
  const navigate = useNavigate();
  const login = useLogin();
  const register = useRegister();
  const mutation = mode === "login" ? login : register;
  const [askImport, setAskImport] = useState(false);

  const submit = (credentials: Credentials) => {
    mutation.mutate(credentials, {
      onSuccess: () => {
        if (hasLocalCustomizations()) setAskImport(true);
        else void navigate("/");
      },
    });
  };

  const finish = () => {
    setAskImport(false);
    void navigate("/");
  };

  return {
    submit,
    pending: mutation.isPending,
    error: mutation.error,
    askImport,
    finish,
  };
};
