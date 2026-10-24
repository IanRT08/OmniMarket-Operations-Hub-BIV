"use server";

import { revalidateTag } from "next/cache";
import { moveOrderSchema, type MoveOrderInput } from "@/features/kanban/schemas";
import type { ActionResult } from "@/lib/action-result";
import { invalidInput, runAction } from "@/server/action-utils";
import { ANALYTICS_CACHE_TAG } from "@/server/dal/analytics";
import { moveOrder as moveOrderInDb, type OrderSummary } from "@/server/dal/orders";
import { requireSession } from "@/server/session";

/**
 * Drag & Drop de una tarjeta. Errores que el cliente debe manejar con
 * rollback + toast:
 *  - VERSION_CONFLICT: otro usuario la movió antes; `details` trae el estado
 *    y la versión actuales para refrescar el cache.
 *  - ORDER_NOT_FOUND / INVALID_INPUT.
 * En éxito devuelve el pedido con su nueva `version` para el siguiente movimiento.
 */
export async function moveOrder(input: MoveOrderInput): Promise<ActionResult<OrderSummary>> {
  const session = await requireSession();

  const parsed = moveOrderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const order = await moveOrderInDb(parsed.data, session.user.id);
    // El conteo por estado cambia siempre; las métricas, si entra/sale de CANCELLED.
    revalidateTag(ANALYTICS_CACHE_TAG, { expire: 0 });
    return order;
  });
}
