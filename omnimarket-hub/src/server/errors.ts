import "server-only";

export type DomainErrorCode =
  | "ORDER_NOT_FOUND"
  | "VERSION_CONFLICT"
  | "ALREADY_IN_STATUS"
  | "PRODUCT_UNAVAILABLE"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_IN_USE"
  | "SKU_TAKEN"
  | "INSUFFICIENT_STOCK";

/**
 * Error de negocio esperado (no un bug). El DAL lo lanza dentro de la
 * transacción —así Prisma hace rollback— y runAction lo convierte en
 * { ok: false, error } con el mismo código para el cliente.
 */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
