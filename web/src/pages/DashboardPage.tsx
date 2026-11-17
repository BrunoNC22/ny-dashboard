import { DATA_COVERAGE } from "@ny-dashboard/shared";
import { Link } from "react-router";

/** Placeholder until the grid, widgets and shell arrive (#36–#49). */
export function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-widest text-cyan-300 uppercase">
        NYC TLC · {DATA_COVERAGE.period.from.slice(0, 7)} →{" "}
        {DATA_COVERAGE.period.to.slice(0, 7)}
      </p>
      <h1 className="bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-6xl">
        NY Dashboard
      </h1>
      <p className="max-w-xl text-slate-400">
        Dashboard personalizável com dados reais de táxis e apps de Nova York.
      </p>
      <nav className="flex gap-3">
        <Link
          to="/login"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm backdrop-blur transition hover:bg-white/10"
        >
          Entrar
        </Link>
        <Link
          to="/cadastro"
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110"
        >
          Criar conta
        </Link>
      </nav>
    </main>
  );
}
