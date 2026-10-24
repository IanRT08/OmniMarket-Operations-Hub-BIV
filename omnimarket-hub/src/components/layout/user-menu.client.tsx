"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const { error } = await authClient.signOut();
      if (error) {
        toast.error("No se pudo cerrar la sesión", { description: error.message });
        return;
      }
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-ink">{name}</p>
        <p className="text-xs text-ink-muted">{email}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={signOut} disabled={isPending}>
        <LogOut className="size-4" aria-hidden="true" />
        Salir
      </Button>
    </div>
  );
}
