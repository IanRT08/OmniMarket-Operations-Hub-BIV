#!/usr/bin/env node
// Verificación del despliegue (solo lectura): npm run smoke -- https://tu-app.vercel.app
//
// Revisa lo que depende de la configuración de Vercel y que un test local no
// puede ver: SSL, variables de entorno, seed, endpoints de auditoría, SLA y
// los callbacks de OAuth. Nunca llama a reset-data con token (no borra nada).

const SLA_MS = 300;
const SAMPLES = 5;

const base = process.argv[2]?.replace(/\/+$/, "");
if (!base || !/^https?:\/\//.test(base)) {
  console.error("Uso: npm run smoke -- https://tu-app.vercel.app");
  process.exit(2);
}
const host = new URL(base).host;

const results = [];
const check = (ok, label, hint) => {
  results.push(ok);
  console.log(`${ok ? "✔" : "✘"} ${label}${!ok && hint ? `\n    → ${hint}` : ""}`);
};

async function get(path, init = {}) {
  const started = performance.now();
  const response = await fetch(base + path, { redirect: "manual", ...init });
  return { response, ms: performance.now() - started };
}

// Traduce los identificadores de error de la BD (ver errorDiagnostics en
// src/server/http.ts) a la variable de Vercel que hay que revisar.
function databaseHint(details) {
  if (!details) return undefined;
  const id = [details.kind, details.code, details.sqlState].filter(Boolean).join(" / ");
  const is = (...values) => values.some((v) => [details.kind, details.code, details.sqlState].includes(v));
  let hint = "revisa DATABASE_URL en Vercel (Production)";
  if (is("AuthenticationFailed", "28P01", "P1000")) hint = "usuario o contraseña de DATABASE_URL incorrectos";
  else if (is("XX000")) hint = "el usuario debe ser el del pooler de Supabase: postgres.<ref-del-proyecto>";
  else if (is("TlsConnectionError", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"))
    hint = "falla el certificado SSL: DATABASE_URL debe terminar en ?sslmode=require&pgbouncer=true&uselibpqcompat=true";
  else if (is("DatabaseNotReachable", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "P1001"))
    hint = "no se alcanza el servidor: revisa host y puerto (6543) de DATABASE_URL";
  else if (is("53300", "TooManyConnections")) hint = "demasiadas conexiones: usa el pooler en modo transacción (puerto 6543)";
  return `Error de base de datos [${id}] → ${hint}`;
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function main() {
  // 1. La app responde por HTTPS y es OmniMarket.
  const { response: login } = await get("/login");
  const html = await login.text();
  check(base.startsWith("https://"), "Se sirve por HTTPS", "Usa la URL https:// de Vercel");
  const isThisApp = login.status === 200 && /<title>[^<]*OmniMarket<\/title>/.test(html);
  check(isThisApp, `/login responde 200 y es esta app (HTTP ${login.status})`);
  if (!isThisApp) {
    // Sin la app correcta, el resto de verificaciones daría pistas engañosas.
    console.log(
      [
        "",
        "  El dominio responde, pero no con esta versión de la app. Causas probables:",
        "  · El pipeline no ha desplegado todavía: revisa la pestaña Actions del repo (job «Desplegar a producción»).",
        "  · El deploy falló: abre el log del job; si faltan secretos de Vercel, lo dice por nombre.",
        "  · La URL no es la del proyecto: usa la que muestra «View deployment» en la corrida.",
      ].join("\n"),
    );
    return false;
  }

  // 2. Rutas privadas protegidas sin sesión.
  const { response: dash } = await get("/dashboard");
  const location = dash.headers.get("location") ?? "";
  check(
    [302, 303, 307, 308].includes(dash.status) && location.includes("/login"),
    "/dashboard sin sesión redirige a /login",
    `HTTP ${dash.status} → ${location || "(sin redirección)"}`,
  );

  // 3. Better Auth montado y con secreto válido.
  const { response: session } = await get("/api/auth/get-session");
  check(session.status === 200, `Better Auth responde (/api/auth/get-session HTTP ${session.status})`, "Revisa BETTER_AUTH_SECRET en Vercel");

  // 4. OAuth: el redirect_uri debe apuntar a ESTE dominio (BETTER_AUTH_URL).
  for (const [provider, authHost] of [["google", "accounts.google.com"], ["github", "github.com"]]) {
    const { response } = await get("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ provider, callbackURL: "/dashboard" }),
    });
    const body = await json(response);
    const url = body?.url ? new URL(body.url) : null;
    const redirectUri = url?.searchParams.get("redirect_uri") ?? "";
    const clientId = url?.searchParams.get("client_id") ?? "";
    check(
      Boolean(url) && url.host.endsWith(authHost) && redirectUri === `${base}/api/auth/callback/${provider}` && clientId && clientId !== "undefined",
      `OAuth ${provider}: redirige a ${authHost} con callback ${base}/api/auth/callback/${provider}`,
      url
        ? `redirect_uri=${redirectUri || "(vacío)"} client_id=${clientId || "(vacío)"} → revisa BETTER_AUTH_URL y ${provider.toUpperCase()}_CLIENT_ID`
        : `HTTP ${response.status} ${JSON.stringify(body)?.slice(0, 160)}`,
    );
  }

  // 5. Endpoints de auditoría habilitados + SLA.
  const samples = [];
  let analytics = null;
  for (let i = 0; i < SAMPLES; i++) {
    const { response, ms } = await get("/api/test/analytics?page=1&limit=50");
    analytics = { status: response.status, body: await json(response), serverTiming: response.headers.get("server-timing"), ms };
    samples.push(analytics);
  }
  check(
    analytics.status === 200,
    `GET /api/test/analytics responde 200 (HTTP ${analytics.status})`,
    analytics.status === 404
      ? "Falta ENABLE_TEST_ENDPOINTS=true en Vercel (y volver a desplegar)"
      : (databaseHint(analytics.body?.error?.details) ?? JSON.stringify(analytics.body)?.slice(0, 200)),
  );
  if (analytics.status === 200) {
    const server = samples.map((s) => s.body?.meta?.durationMs ?? Infinity).sort((a, b) => a - b);
    const total = samples.map((s) => s.ms).sort((a, b) => a - b);
    const median = (xs) => xs[Math.floor(xs.length / 2)];
    // La primera petición puede incluir el arranque en frío de la función.
    check(
      median(server) < SLA_MS,
      `SLA: mediana en servidor ${median(server).toFixed(1)} ms (< ${SLA_MS} ms) · ida y vuelta desde aquí ${median(total).toFixed(0)} ms`,
      "Revisa que la BD y las funciones estén en la misma región (iad1 / us-east-1)",
    );
    check(Boolean(analytics.serverTiming), `Header Server-Timing presente (${analytics.serverTiming})`);
    check(
      (analytics.body?.pagination?.total ?? 0) > 0,
      `Hay métricas sembradas (${analytics.body?.pagination?.total ?? 0} días)`,
      "Siembra la BD: POST /api/test/reset-data con el header x-audit-token, o npm run db:seed",
    );
  }

  // 6. kanban-status con el pedido del seed.
  const { response: kanban } = await get("/api/test/kanban-status?orderId=OM-E2E-0001");
  const kanbanBody = await json(kanban);
  check(
    kanban.status === 200,
    `GET /api/test/kanban-status?orderId=OM-E2E-0001 → ${kanbanBody?.data?.order?.status ?? `HTTP ${kanban.status}`}`,
    kanbanBody?.error?.code === "ORDER_NOT_FOUND" ? "La BD no tiene el seed: ejecuta el reset-data" : JSON.stringify(kanbanBody)?.slice(0, 200),
  );

  // 7. reset-data protegido (sin token NO borra nada).
  const { response: reset } = await get("/api/test/reset-data", { method: "POST" });
  check(
    reset.status === 401,
    `POST /api/test/reset-data sin token → 401 (HTTP ${reset.status})`,
    reset.status === 503 ? "Falta AUDIT_TOKEN en Vercel" : undefined,
  );
  return true;
}

let complete = false;
try {
  complete = await main();
} catch (error) {
  check(false, `No se pudo conectar con ${host}`, error instanceof Error ? error.message : String(error));
}

const failed = results.filter((ok) => !ok).length;
if (complete) console.log(failed === 0 ? `\nTodo en orden en ${host}.` : `\n${failed} verificación(es) fallaron en ${host}.`);
// exitCode en vez de process.exit(): cerrar con sockets de fetch abiertos
// dispara un assert de libuv en Windows.
process.exitCode = failed === 0 ? 0 : 1;
