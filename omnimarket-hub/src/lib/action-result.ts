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

/**
 * Error de una Server Action del lado del cliente. TanStack Query necesita
 * que la mutación lance para entrar a onError; esta clase conserva el código
 * para decidir el rollback y el texto del toast.
 */
export class ActionFailure extends Error {
  constructor(readonly error: ActionError) {
    super(error.message);
    this.name = "ActionFailure";
  }

  get code() {
    return this.error.code;
  }
}

/** Devuelve `data` o lanza ActionFailure: adapta el contrato ActionResult a mutationFn. */
export function unwrapAction<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ActionFailure(result.error);
}
