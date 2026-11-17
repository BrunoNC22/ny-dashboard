import { AuthForm } from "../components/auth/AuthForm";
import { ImportLocalModal } from "../components/auth/ImportLocalModal";
import { useAuthFlow } from "../components/auth/useAuthFlow";

export function RegisterPage() {
  const { submit, pending, error, askImport, finish } = useAuthFlow("register");
  return (
    <>
      <AuthForm
        mode="register"
        pending={pending}
        error={error}
        onSubmit={submit}
      />
      <ImportLocalModal open={askImport} onDone={finish} />
    </>
  );
}
