import "server-only";

import { db } from "@/server/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Estado actual de un pedido en el tablero y su último movimiento registrado
 * en order_status_events. `orderRef` acepta el UUID o el número de pedido
 * (p. ej. "OM-E2E-0001"), así la prueba E2E no depende de IDs internos.
 *
 * El último evento sale del índice (order_id, created_at DESC): es un
 * Index Scan con LIMIT 1, sin importar cuántos movimientos tenga el pedido.
 *
 * @returns null si el pedido no existe.
 */
export async function getOrderKanbanStatus(orderRef: string) {
  const order = await db.order.findUnique({
    where: UUID_PATTERN.test(orderRef) ? { id: orderRef } : { orderNumber: orderRef },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      position: true,
      version: true,
      updatedAt: true,
      events: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { id: true, fromStatus: true, toStatus: true, actorId: true, createdAt: true },
      },
    },
  });

  if (!order) return null;

  const { events, ...current } = order;
  const lastEvent = events[0] ?? null;

  return {
    order: current,
    // BigInt no es serializable a JSON: se expone como string.
    lastEvent: lastEvent && { ...lastEvent, id: lastEvent.id.toString() },
  };
}

export type OrderKanbanStatus = NonNullable<Awaited<ReturnType<typeof getOrderKanbanStatus>>>;
