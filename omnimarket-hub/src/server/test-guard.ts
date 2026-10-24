import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

// ============================================================================
// Protección de /api/test/*
// ----------------------------------------------------------------------------
// - ENABLE_TEST_ENDPOINTS !== "true"  => todas las rutas responden 404, como
//   si no existieran.
// - reset-data además exige el header x-audit-token igual a AUDIT_TOKEN.
// Ambos guards devuelven `null` si la petición puede continuar, o la
// Response de rechazo lista para retornarse desde el route handler.
// ============================================================================

export const AUDIT_TOKEN_HEADER = "x-audit-token";

function rejection(status: number, code: string, message: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function guardTestEndpoint(): Response | null {
  if (process.env.ENABLE_TEST_ENDPOINTS !== "true") {
    return rejection(404, "NOT_FOUND", "Not found");
  }
  return null;
}

export function guardAuditToken(request: Request): Response | null {
  const disabled = guardTestEndpoint();
  if (disabled) return disabled;

  const expected = process.env.AUDIT_TOKEN;
  // Falla cerrado: sin token configurado nadie puede ejecutar el reset.
  if (!expected) {
    return rejection(503, "AUDIT_TOKEN_NOT_CONFIGURED", "AUDIT_TOKEN no está configurado");
  }

  const provided = request.headers.get(AUDIT_TOKEN_HEADER);
  if (!provided || !safeEqual(provided, expected)) {
    return rejection(401, "INVALID_AUDIT_TOKEN", `Header ${AUDIT_TOKEN_HEADER} ausente o inválido`);
  }

  return null;
}

// Comparación en tiempo constante. Se comparan los SHA-256 porque
// timingSafeEqual exige buffers de igual longitud y comparar longitudes
// directamente filtraría el tamaño del token.
function safeEqual(a: string, b: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
