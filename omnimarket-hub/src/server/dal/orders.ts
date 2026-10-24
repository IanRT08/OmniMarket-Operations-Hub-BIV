import "server-only";

import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import type { MoveOrderData } from "@/features/kanban/schemas";
import type { CreateOrderData } from "@/features/orders/schemas";
import { toBusinessDay } from "@/lib/dates";
import { positionAfter } from "@/lib/position";
import { applyOrderToDailyMetrics } from "@/server/dal/analytics";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";

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

// ============================================================================
// Mutaciones. Las usan las Server Actions de orders/ y kanban/. Cada una es
// una transacción que incluye el evento de order_status_events y el ajuste
// de daily_sales_metrics: o se aplica todo, o nada.
// ============================================================================

const orderSummarySelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  customerEmail: true,
  status: true,
  position: true,
  version: true,
  totalCents: true,
  costCents: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

export type OrderSummary = Prisma.OrderGetPayload<{ select: typeof orderSummarySelect }>;

// Margen de tiempo para BDs serverless con cold start.
const TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 };

// Base32 de Crockford: sin I, L, O ni U para evitar confusiones al dictarlo.
const ORDER_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** p. ej. "OM-261024-7K2F9Q": día de negocio + 6 caracteres aleatorios (32^6 ≈ 10^9 por día). */
function generateOrderNumber(now: Date): string {
  const day = toBusinessDay(now).slice(2).replaceAll("-", "");
  const code = Array.from({ length: 6 }, () => ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)]);
  return `OM-${day}-${code.join("")}`;
}

/**
 * Llave fraccional para el final de una columna. Lee la última posición con
 * el índice (status, position). Dos inserciones simultáneas pueden obtener
 * la misma llave; positionBetween() tolera ese empate al mover tarjetas.
 */
async function positionAtEndOfColumn(tx: Prisma.TransactionClient, status: OrderStatus) {
  const last = await tx.order.findFirst({
    where: { status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return positionAfter(last?.position ?? null);
}

/**
 * Crea un pedido PENDING al final de su columna. Precios y costos se copian
 * del catálogo en este momento (snapshot), junto con los totales del pedido.
 */
export async function createOrder(input: CreateOrderData, actorId: string): Promise<OrderSummary> {
  return db.$transaction(async (tx) => {
    const productIds = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, priceCents: true, costCents: true },
    });

    const catalog = new Map(products.map((product) => [product.id, product]));
    const unavailable = productIds.filter((id) => !catalog.has(id));
    if (unavailable.length > 0) {
      throw new DomainError("PRODUCT_UNAVAILABLE", "Uno o más productos no existen o están inactivos", {
        productIds: unavailable,
      });
    }

    const items = input.items.map(({ productId, quantity }) => {
      const product = catalog.get(productId)!;
      return { productId, quantity, unitPriceCents: product.priceCents, unitCostCents: product.costCents };
    });
    const totalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const costCents = items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0);

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(new Date()),
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        status: OrderStatus.PENDING,
        position: await positionAtEndOfColumn(tx, OrderStatus.PENDING),
        totalCents,
        costCents,
        createdById: actorId,
        items: { createMany: { data: items } },
        events: { create: { fromStatus: null, toStatus: OrderStatus.PENDING, actorId } },
      },
      select: orderSummarySelect,
    });

    await applyOrderToDailyMetrics(tx, order.id, 1);
    return order;
  }, TX_OPTIONS);
}

type Transition = {
  orderId: string;
  expectedVersion: number;
  toStatus: OrderStatus;
  position: string;
  actorId: string;
  /** Rechaza la operación si el pedido ya está en `toStatus` (p. ej. cancelar dos veces). */
  rejectSameStatus?: boolean;
};

/**
 * Núcleo de moveOrder/cancelOrder: concurrencia optimista + bitácora +
 * métricas, todo dentro de `tx`.
 *
 * UPDATE … WHERE id = $1 AND version = $2: si afecta 0 filas, otro usuario
 * movió el pedido después de que el cliente lo leyó → VERSION_CONFLICT y el
 * cliente revierte su actualización optimista. Como cada cambio incrementa
 * `version`, que el UPDATE tenga éxito garantiza que el estado leído antes
 * (fromStatus del evento) corresponde a esa misma versión.
 */
async function transitionOrder(tx: Prisma.TransactionClient, transition: Transition): Promise<OrderSummary> {
  const { orderId, expectedVersion, toStatus, position, actorId } = transition;

  const current = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true, version: true },
  });
  if (!current) throw new DomainError("ORDER_NOT_FOUND", "El pedido no existe", { orderId });

  if (transition.rejectSameStatus && current.status === toStatus) {
    throw new DomainError("ALREADY_IN_STATUS", `El pedido ya está en ${toStatus}`, {
      currentStatus: current.status,
      currentVersion: current.version,
    });
  }

  const [order] = await tx.order.updateManyAndReturn({
    where: { id: orderId, version: expectedVersion },
    data: { status: toStatus, position, version: { increment: 1 } },
    select: orderSummarySelect,
  });

  if (!order) {
    throw new DomainError("VERSION_CONFLICT", "Otro usuario modificó este pedido; recarga el tablero", {
      currentStatus: current.status,
      currentVersion: current.version,
    });
  }

  // Cada movimiento queda en la bitácora, también un reordenamiento dentro
  // de la misma columna (fromStatus = toStatus).
  await tx.orderStatusEvent.create({
    data: { orderId, fromStatus: current.status, toStatus, actorId },
  });

  // Las métricas excluyen pedidos CANCELLED: solo cambian al entrar o salir de ese estado.
  if (current.status !== toStatus) {
    if (toStatus === OrderStatus.CANCELLED) await applyOrderToDailyMetrics(tx, orderId, -1);
    else if (current.status === OrderStatus.CANCELLED) await applyOrderToDailyMetrics(tx, orderId, 1);
  }

  return order;
}

/** Cancela un pedido y lo coloca al final de la columna CANCELLED. */
export async function cancelOrder(
  { orderId, version }: { orderId: string; version: number },
  actorId: string,
): Promise<OrderSummary> {
  return db.$transaction(
    async (tx) =>
      transitionOrder(tx, {
        orderId,
        expectedVersion: version,
        toStatus: OrderStatus.CANCELLED,
        position: await positionAtEndOfColumn(tx, OrderStatus.CANCELLED),
        actorId,
        rejectSameStatus: true,
      }),
    TX_OPTIONS,
  );
}

/** Drag & Drop: mueve un pedido a `toStatus` en la posición calculada por el cliente. Actualiza 1 fila de orders. */
export async function moveOrder(input: MoveOrderData, actorId: string): Promise<OrderSummary> {
  return db.$transaction(
    (tx) =>
      transitionOrder(tx, {
        orderId: input.orderId,
        expectedVersion: input.version,
        toStatus: input.toStatus,
        position: input.position,
        actorId,
      }),
    TX_OPTIONS,
  );
}
