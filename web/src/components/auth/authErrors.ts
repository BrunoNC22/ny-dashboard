import { isApiError } from "../../api/client";

/** pt-BR message for an API error of the auth endpoints. */
export const authErrorMessage = (error: unknown): string => {
  if (isApiError(error, "INVALID_CREDENTIALS"))
    return "Usuário ou senha inválidos.";
  if (isApiError(error, "CONFLICT"))
    return "Este nome de usuário já está em uso.";
  if (isApiError(error, "NETWORK_ERROR"))
    return "Sem conexão com o servidor. Tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
};
