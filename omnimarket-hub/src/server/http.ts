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

export function unexpectedErrorResponse(timer: Timer, error: unknown) {
  console.error("[api/test]", error);
  // En producción no se filtran detalles internos (SQL, host de la BD, etc.).
  const message =
    process.env.NODE_ENV === "production" || !(error instanceof Error)
      ? "Error interno del servidor"
      : error.message;
  return errorResponse(timer, 500, "INTERNAL_ERROR", message);
}
