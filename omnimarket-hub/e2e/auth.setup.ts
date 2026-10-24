import { createHmac } from "node:crypto";
import { expect, test as setup } from "@playwright/test";
import { SEED_COUNTS, STORAGE_STATE } from "./fixtures/seed-ids";

// En CI nunca se toca Google ni GitHub: reset-data inserta una sesión con
// token conocido (E2E_SESSION_TOKEN) y aquí se construye la cookie firmada
// tal como la emite Better Auth: encodeURIComponent(`${token}.${firma}`),
// donde firma = base64(HMAC-SHA256(BETTER_AUTH_SECRET, token)).
// Con BETTER_AUTH_URL en https, Better Auth antepone "__Secure-" al nombre.
const SESSION_COOKIE = "better-auth.session_token";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} para E2E`);
  return value;
}

setup("reset de datos y sesión simulada", async ({ request, context, baseURL }) => {
  const reset = await request.post("/api/test/reset-data", {
    headers: { "x-audit-token": requiredEnv("AUDIT_TOKEN") },
  });
  expect(reset.status(), await reset.text()).toBe(200);

  const body = await reset.json();
  expect(body.data).toMatchObject({ ...SEED_COUNTS, e2eSession: true });

  const sessionToken = requiredEnv("E2E_SESSION_TOKEN");
  const signature = createHmac("sha256", requiredEnv("BETTER_AUTH_SECRET")).update(sessionToken).digest("base64");

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: encodeURIComponent(`${sessionToken}.${signature}`),
      url: baseURL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // La sesión debe ser válida para Better Auth, no solo existir como cookie.
  const session = await context.request.get("/api/auth/get-session");
  expect(session.status()).toBe(200);
  expect((await session.json())?.user?.id).toBe("e2e-user");

  await context.storageState({ path: STORAGE_STATE });
});
