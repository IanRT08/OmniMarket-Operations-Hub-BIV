import "server-only";

// ============================================================================
// Respuestas JSON de los endpoints de auditoría (/api/test/*).
// Cada respuesta lleva `meta.durationMs` y un header Server-Timing para que la
// latencia se pueda demostrar desde el navegador o desde Playwright.
// ============================================================================

const round = (ms: number) => Math.round(ms * 100) / 100;

export type Timer = ReturnType<typeof createTimer>;

export function createTimer() {
  const start = performance.now();
  const phases: Record<string, number> = {};

  return {
    /** Ejecuta `fn` y registra su duración como una fase de Server-Timing. */
    async measure<T>(phase: string, fn: () => Promise<T>): Promise<T> {
      const phaseStart = performance.now();
      try {
        return await fn();
      } finally {
        phases[phase] = performance.now() - phaseStart;
      }
    },
    elapsed: () => round(performance.now() - start),
    serverTiming(total: number) {
      return [
        ...Object.entries(phases).map(([phase, ms]) => `${phase};dur=${round(ms)}`),
        `total;dur=${total}`,
      ].join(", ");
    },
  };
}

export function jsonResponse(timer: Timer, body: Record<string, unknown>, status = 200) {
  const durationMs = timer.elapsed();

  return Response.json(
    { ...body, meta: { durationMs } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": timer.serverTiming(durationMs),
      },
    },
  );
}

export function errorResponse(
  timer: Timer,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return jsonResponse(timer, { ok: false, error: { code, message, details } }, status);
}

type DriverCause = { kind?: unknown; originalCode?: unknown };
type DbError = Error & { code?: unknown; meta?: { driverAdapterError?: { cause?: DriverCause } }; cause?: DriverCause };

/**
 * Identificadores del error para diagnosticar desde fuera (p. ej. con
 * `npm run smoke`): tipo, código de Prisma, clase de fallo del driver y
 * código SQLSTATE de Postgres. Nunca el mensaje: puede incluir host o usuario.
 */
function errorDiagnostics(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  const e = error as DbError;
  const cause = e.meta?.driverAdapterError?.cause ?? e.cause;
  const id = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : undefined);
  return { type: e.name, code: id(e.code), kind: id(cause?.kind), sqlState: id(cause?.originalCode) };
}

export function unexpectedErrorResponse(timer: Timer, error: unknown) {
  console.error("[api/test]", error);
  // En producción no se filtra el mensaje (SQL, host de la BD, etc.), solo
  // los identificadores de errorDiagnostics.
  const message =
    process.env.NODE_ENV === "production" || !(error instanceof Error)
      ? "Error interno del servidor"
      : error.message;
  return errorResponse(timer, 500, "INTERNAL_ERROR", message, errorDiagnostics(error));
}
