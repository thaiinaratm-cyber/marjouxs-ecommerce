import { LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAction } from "@/app/admin/login/actions";

const errorMessages: Record<string, string> = {
  access_denied: "Este usuário não possui acesso administrativo ativo.",
  authentication: "Sua sessão expirou. Entre novamente.",
  configuration: "A configuração pública do Supabase ainda não foi concluída.",
  invalid_credentials: "E-mail ou senha inválidos.",
  verification: "Não foi possível verificar a permissão administrativa agora."
};

type AdminLoginPageProps = {
  searchParams?: {
    error?: string;
    logged_out?: string;
  };
};

export default function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const error = searchParams?.error ? errorMessages[searchParams.error] : null;

  return (
    <section className="mx-auto flex min-h-[68vh] max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-champagne text-gold">
          <LockKeyhole size={20} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold">Área restrita</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-ink">Painel Marjouxs</h1>
        <p className="mt-3 text-sm leading-6 text-taupe">
          Entre com um usuário autorizado no Supabase Auth.
        </p>

        {error ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {searchParams?.logged_out ? (
          <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Sessão encerrada com segurança.
          </div>
        ) : null}

        <form action={loginAction} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            E-mail
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              className="h-11 rounded-md border border-black/15 bg-white px-3 font-normal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Senha
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
              className="h-11 rounded-md border border-black/15 bg-white px-3 font-normal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
          >
            <ShieldCheck size={17} aria-hidden="true" />
            Entrar no painel
          </button>
        </form>
      </div>
    </section>
  );
}
