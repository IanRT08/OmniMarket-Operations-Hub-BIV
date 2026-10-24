import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { LoginButtons } from "./login-buttons.client";

export const metadata: Metadata = { title: "Iniciar sesión" };

const DEFAULT_REDIRECT = "/dashboard";

// Solo rutas internas: evita usar el login como redirección abierta a otro dominio.
function safeCallbackUrl(value: string | string[] | undefined) {
  const url = Array.isArray(value) ? value[0] : value;
  return url && url.startsWith("/") && !url.startsWith("//") ? url : DEFAULT_REDIRECT;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const callbackURL = safeCallbackUrl((await searchParams).callbackUrl);
  if (await getSession()) redirect(callbackURL);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-moss text-lg font-bold text-white" aria-hidden="true">
            OM
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">OmniMarket Operations Hub</h1>
            <p className="mt-1 text-sm text-ink-muted">Inicia sesión para gestionar tus pedidos.</p>
          </div>
        </div>
        <LoginButtons callbackURL={callbackURL} />
      </div>
    </main>
  );
}
