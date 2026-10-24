"use server";

import { revalidateTag } from "next/cache";
import {
  bulkUpdateSchema,
  cancelOrderSchema,
  createOrderSchema,
  orderListQuerySchema,
  type BulkUpdateInput,
  type CancelOrderInput,
  type CreateOrderInput,
  type OrderListQuery,
} from "@/features/orders/schemas";
import type { ActionResult } from "@/lib/action-result";
import { invalidInput, runAction } from "@/server/action-utils";
import { ANALYTICS_CACHE_TAG } from "@/server/dal/analytics";
import * as ordersDal from "@/server/dal/orders";
import { requireSession } from "@/server/session";

/**
 * Lectura de la tabla de pedidos para TanStack Query (prefetch en el RSC y
 * refetch en el cliente). Revalida la consulta: los argumentos de una Server
 * Action llegan del cliente. Lanza si falla; useQuery gestiona el error.
 */
export async function fetchOrders(query: OrderListQuery): Promise<ordersDal.OrderList> {
  await requireSession();
  return ordersDal.listOrders(orderListQuerySchema.parse(query));
}

// Todas las acciones ajustan stock y daily_sales_metrics dentro de la
// transacción del DAL y después invalidan el tag `analytics`. { expire: 0 }:
// el siguiente render de los KPIs espera datos frescos en vez de servir los
// anteriores, así quien muta ve su cambio de inmediato (equivale a updateTag).
//
// Errores de dominio que el cliente debe manejar: INVALID_INPUT,
// PRODUCT_UNAVAILABLE e INSUFFICIENT_STOCK (details.shortfalls),
// ORDER_NOT_FOUND, ALREADY_IN_STATUS y VERSION_CONFLICT.

export async function createOrder(input: CreateOrderInput): Promise<ActionResult<ordersDal.OrderSummary>> {
  const session = await requireSession();

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const order = await ordersDal.createOrder(parsed.data, session.user.id);
    revalidateTag(ANALYTICS_CACHE_TAG, { expire: 0 });
    return order;
  });
}

export async function cancelOrder(input: CancelOrderInput): Promise<ActionResult<ordersDal.OrderSummary>> {
  const session = await requireSession();

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const order = await ordersDal.cancelOrder(parsed.data, session.user.id);
    revalidateTag(ANALYTICS_CACHE_TAG, { expire: 0 });
    return order;
  });
}

/** Cambia el estado de hasta 100 pedidos seleccionados en la tabla. */
export async function bulkUpdateStatus(
  input: BulkUpdateInput,
): Promise<ActionResult<ordersDal.BulkUpdateResult>> {
  const session = await requireSession();

  const parsed = bulkUpdateSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const result = await ordersDal.bulkUpdateStatus(parsed.data, session.user.id);
    if (result.updated.length > 0) revalidateTag(ANALYTICS_CACHE_TAG, { expire: 0 });
    return result;
  });
}
