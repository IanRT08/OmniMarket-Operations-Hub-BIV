import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type Session } from "@/server/auth";

export const LOGIN_PATH = "/login";

/**
 * Sesión actual o null. `cache` la memoriza por request: layout, página y
 * Server Actions de un mismo render comparten una sola lectura.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Autorización real (proxy.ts solo hace un chequeo optimista de cookie).
 * Úsala en (dashboard)/layout.tsx y al inicio de cada Server Action.
 * Sin sesión redirige a /login; redirect() lanza, así que nunca devuelve null.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}
