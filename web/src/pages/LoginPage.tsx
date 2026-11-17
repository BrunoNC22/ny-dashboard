import { Link } from "react-router";

/** Placeholder: the login form arrives with the auth UI (#34). */
export function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <Link to="/" className="text-sm text-cyan-300 hover:underline">
        Voltar ao dashboard
      </Link>
    </main>
  );
}
