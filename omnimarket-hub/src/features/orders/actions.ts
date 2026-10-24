"use server";

import { revalidateTag } from "next/cache";
import {
  cancelOrderSchema,
  createOrderSchema,
  type CancelOrderInput,
  type CreateOrderInput,
} from "@/features/orders/schemas";
import type { ActionResult } from "@/lib/action-result";
import { invalidInput, runAction } from "@/server/action-utils";
import { ANALYTICS_CACHE_TAG } from "@/server/dal/analytics";
import * as ordersDal from "@/server/dal/orders";
import { requireSession } from "@/server/session";

// Ambas acciones ajustan daily_sales_metrics dentro de la transacción del DAL
// y después invalidan el tag `analytics`. { expire: 0 }: el siguiente render
// de los KPIs espera datos frescos en vez de servir los anteriores, así quien
// crea o cancela ve su cambio de inmediato (equivale a updateTag).

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
