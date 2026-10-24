import "server-only";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { DomainError } from "@/server/errors";

/** Resultado de validación fallida con los errores por campo de Zod. */
export function invalidInput(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: { code: "INVALID_INPUT", message: "Datos inválidos", details: z.flattenError(error) },
  };
}

/**
 * Ejecuta la mutación y traduce excepciones al contrato ActionResult.
 * requireSession() debe llamarse ANTES, fuera de runAction: su redirect()
 * funciona lanzando una excepción que aquí se tragaría.
 */
export async function runAction<T>(mutation: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await mutation() };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    console.error("[server-action]", error);
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" } };
  }
}
