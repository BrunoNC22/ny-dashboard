import { AuthForm } from "../components/auth/AuthForm";
import { ImportLocalModal } from "../components/auth/ImportLocalModal";
import { useAuthFlow } from "../components/auth/useAuthFlow";

export function LoginPage() {
  const { submit, pending, error, askImport, finish } = useAuthFlow("login");
  return (
    <>
      <AuthForm
        mode="login"
        pending={pending}
        error={error}
        onSubmit={submit}
      />
      <ImportLocalModal open={askImport} onDone={finish} />
    </>
  );
}
