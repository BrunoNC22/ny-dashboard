import { type Credentials, credentialsSchema } from "@ny-dashboard/shared";
import { CircleAlert, LogIn, UserPlus } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Link } from "react-router";

import { Button, Card, Input } from "../ui";
import { authErrorMessage } from "./authErrors";

export type AuthMode = "login" | "register";

interface FieldErrors {
  username?: string;
  password?: string;
  confirm?: string;
}

const COPY = {
  login: {
    title: "Entrar",
    subtitle: "Acesse seu dashboard em qualquer dispositivo.",
    submit: "Entrar",
    switchText: "Ainda não tem conta?",
    switchLink: "Criar conta",
    switchTo: "/cadastro",
  },
  register: {
    title: "Criar conta",
    subtitle:
      "Seu dashboard salvo na nuvem. Simples de propósito: só usuário e senha.",
    submit: "Criar conta",
    switchText: "Já tem conta?",
    switchLink: "Entrar",
    switchTo: "/login",
  },
} as const;

export interface AuthFormProps {
  mode: AuthMode;
  pending: boolean;
  error: unknown;
  onSubmit: (credentials: Credentials) => void;
}

/** Glass card with username/password (and confirmation on sign-up), validated with the shared schema. */
export function AuthForm({ mode, pending, error, onSubmit }: AuthFormProps) {
  const copy = COPY[mode];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ username, password });
    const next: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "username") next.username ??= issue.message;
        if (field === "password") next.password ??= issue.message;
      }
    }
    if (mode === "register" && password !== confirm)
      next.confirm = "As senhas não conferem.";
    setErrors(next);
    if (parsed.success && Object.keys(next).length === 0) onSubmit(parsed.data);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card highlight className="w-full max-w-sm">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1 text-center">
            <Link
              to="/"
              className="text-accent-gradient text-sm font-semibold tracking-wide"
            >
              NY Dashboard
            </Link>
            <h1 className="text-2xl font-semibold text-ink">{copy.title}</h1>
            <p className="text-sm text-ink-2">{copy.subtitle}</p>
          </div>
          <Input
            label="Usuário"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            error={errors.username}
            onChange={(event) => {
              setUsername(event.target.value);
            }}
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            error={errors.password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
          {mode === "register" && (
            <Input
              label="Confirmar senha"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              error={errors.confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
              }}
            />
          )}
          {error !== null && error !== undefined && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-ink"
            >
              <CircleAlert
                size={16}
                className="shrink-0 text-critical"
                aria-hidden
              />
              {authErrorMessage(error)}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            icon={
              mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />
            }
          >
            {copy.submit}
          </Button>
          <p className="text-center text-sm text-ink-2">
            {copy.switchText}{" "}
            <Link
              to={copy.switchTo}
              className="font-medium text-accent hover:underline"
            >
              {copy.switchLink}
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
