import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

// Índice fraccional del Kanban. Las llaves se comparan byte a byte (`<` de
// JS = COLLATE "C" en Postgres), así que mover una tarjeta solo actualiza su
// propia fila.

const BASE_62_KEY = /^[0-9A-Za-z]+$/;

/**
 * Llave para colocar una tarjeta entre `before` (la de arriba) y `after`
 * (la de abajo). `null` significa extremo de la columna.
 *
 * Si las vecinas están empatadas o invertidas (dos inserciones simultáneas
 * calcularon la misma llave), la tarjeta queda justo después de `before` en
 * lugar de lanzar un error.
 */
export function positionBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) {
    return generateKeyBetween(before, null);
  }
  return generateKeyBetween(before, after);
}

/** Llave para colocar una tarjeta al final de una columna cuyo último elemento es `last`. */
export function positionAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

/** `count` llaves consecutivas y ordenadas para añadir varias tarjetas al final de una columna. */
export function positionsAfter(last: string | null, count: number): string[] {
  return generateNKeysBetween(last, null, count);
}

/** true si `key` es una llave fraccional válida (lo que espera la columna orders.position). */
export function isValidPosition(key: string): boolean {
  if (key.length === 0 || key.length > 64 || !BASE_62_KEY.test(key)) return false;
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}
