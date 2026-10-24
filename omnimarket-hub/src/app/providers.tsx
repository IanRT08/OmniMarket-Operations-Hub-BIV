"use client";

import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Con datos precargados en el RSC, evita volver a pedirlos al hidratar.
        staleTime: 30_000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// En el servidor, un cliente por request (nunca compartir cache entre
// usuarios); en el navegador, uno solo para toda la sesión, para que no se
// pierda si React suspende durante el render inicial.
function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Abajo a la derecha: arriba taparía el menú de usuario del header. */}
      <Toaster position="bottom-right" richColors closeButton duration={4000} />
    </QueryClientProvider>
  );
}
