"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const PROVIDERS = [
  { id: "google", label: "Continuar con Google", variant: "primary" },
  { id: "github", label: "Continuar con GitHub", variant: "outline" },
] as const;

type Provider = (typeof PROVIDERS)[number]["id"];

export function LoginButtons({ callbackURL }: { callbackURL: string }) {
  const [pending, setPending] = useState<Provider | null>(null);

  async function signIn(provider: Provider) {
    setPending(provider);
    // Redirige al proveedor; al volver, Better Auth crea la sesión y manda a callbackURL.
    const { error } = await authClient.signIn.social({ provider, callbackURL });
    if (error) {
      setPending(null);
      toast.error("No se pudo iniciar sesión", { description: error.message });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map(({ id, label, variant }) => (
        <Button key={id} variant={variant} size="lg" disabled={pending !== null} onClick={() => signIn(id)}>
          {pending === id ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogIn className="size-4" aria-hidden="true" />
          )}
          {label}
        </Button>
      ))}
    </div>
  );
}
