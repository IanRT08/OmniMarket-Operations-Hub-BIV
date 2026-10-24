// Contrato de las Server Actions: nunca lanzan, devuelven un resultado.
// En producción Next sanitiza los errores lanzados y el cliente necesita el
// código para decidir entre rollback + toast o reintento.

export type ActionError = {
  code: string;
  message: string;
  /** Errores de validación por campo (Zod), o contexto del error de dominio. */
  details?: unknown;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
