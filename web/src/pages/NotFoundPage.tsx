import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-semibold text-slate-500">404</p>
      <h1 className="text-xl">Página não encontrada</h1>
      <Link to="/" className="text-sm text-cyan-300 hover:underline">
        Ir para o dashboard
      </Link>
    </main>
  );
}
