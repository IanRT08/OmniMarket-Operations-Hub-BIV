import "server-only";

import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import type { MoveOrderData } from "@/features/kanban/schemas";
import type { BulkUpdateData, CreateOrderData, OrderListQuery } from "@/features/orders/schemas";
import { addDays, businessDayStart, toBusinessDay } from "@/lib/dates";
import { positionAfter, positionsAfter } from "@/lib/position";
import { applyOrdersToDailyMetrics, countOrdersByStatus } from "@/server/dal/analytics";
import { releaseStockForOrders, reserveStockForOrders } from "@/server/dal/products";
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
// Lecturas para la UI
// ============================================================================

/**
 * Tabla de pedidos con paginación y filtros del lado del servidor.
 *
 * - Fechas: from/to son días de negocio de CDMX (inclusivos). Se convierten
 *   a un rango de instantes sobre created_at, así se usa el índice
 *   orders(created_at DESC) en lugar de convertir cada fila de zona horaria.
 * - Búsqueda: ILIKE '%q%' sobre número, nombre y email. No usa índice; con
 *   cientos de miles de pedidos convendría un índice trigram (pg_trgm).
 * - Orden: más recientes primero, con id como desempate estable entre páginas.
 */
export async function listOrders({ page, pageSize, status, from, to, q }: OrderListQuery) {
  const where: Prisma.OrderWhereInput = {
    ...(status.length > 0 && { status: { in: status } }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: businessDayStart(from) }),
        ...(to && { lt: businessDayStart(addDays(to, 1)) }),
      },
    }),
    ...(q && {
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        status: true,
        version: true,
        totalCents: true,
        costCents: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    rows: rows.map(({ _count, ...order }) => ({ ...order, itemsCount: _count.items })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  };
}

export type OrderList = Awaited<ReturnType<typeof listOrders>>;
export type OrderListItem = OrderList["rows"][number];

export const KANBAN_COLUMN_LIMIT = 100;

/**
 * Tablero completo: una columna por estado, ordenada por `position`.
 * Cada columna es un Index Scan sobre (status, position) con LIMIT, y las 5
 * van en paralelo junto con el conteo total por estado. `total` permite a la
 * UI mostrar "100 de 2,340" cuando una columna (típicamente DELIVERED) excede
 * el límite.
 *
 * `version` viaja en cada tarjeta: moveOrder la exige para detectar
 * movimientos simultáneos.
 */
export async function getKanbanBoard(limitPerColumn: number = KANBAN_COLUMN_LIMIT) {
  const statuses = Object.values(OrderStatus);

  const [counts, ...columns] = await Promise.all([
    countOrdersByStatus(),
    ...statuses.map((status) =>
      db.order.findMany({
        where: { status },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        take: limitPerColumn,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          position: true,
          version: true,
          totalCents: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
    ),
  ]);

  return {
    columns: statuses.map((status, i) => ({
      status,
      total: counts[status],
      cards: columns[i].map(({ _count, ...card }) => ({ ...card, itemsCount: _count.items })),
    })),
  };
}

export type KanbanBoard = Awaited<ReturnType<typeof getKanbanBoard>>;
export type KanbanCard = KanbanBoard["columns"][number]["cards"][number];

// ============================================================================
// Mutaciones. Las usan las Server Actions de orders/ y kanban/. Cada una es
// una transacción que incluye el evento de order_status_events y los ajustes
// de stock y de daily_sales_metrics: o se aplica todo, o nada.
//
// Orden de locks, igual en todas las mutaciones: orders → products →
// daily_sales_metrics. Con un orden único, dos transacciones concurrentes
// pueden esperarse pero no bloquearse mutuamente.
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
 * Última llave fraccional de una columna, con el índice (status, position).
 * Dos inserciones simultáneas pueden calcular la misma llave siguiente;
 * positionBetween() tolera ese empate al mover tarjetas.
 */
async function lastPositionInColumn(tx: Prisma.TransactionClient, status: OrderStatus) {
  const last = await tx.order.findFirst({
    where: { status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return last?.position ?? null;
}

async function positionAtEndOfColumn(tx: Prisma.TransactionClient, status: OrderStatus) {
  return positionAfter(await lastPositionInColumn(tx, status));
}

/**
 * Los pedidos pasan a contar como venta (al crearse o al salir de
 * CANCELLED): descuenta su stock y los suma a las métricas del día.
 * Puede lanzar INSUFFICIENT_STOCK, que revierte toda la transacción.
 */
async function activateOrders(tx: Prisma.TransactionClient, orderIds: string[]) {
  await reserveStockForOrders(tx, orderIds);
  await applyOrdersToDailyMetrics(tx, orderIds, 1);
}

/** Los pedidos dejan de contar como venta (entran a CANCELLED): repone stock y resta métricas. */
async function deactivateOrders(tx: Prisma.TransactionClient, orderIds: string[]) {
  await releaseStockForOrders(tx, orderIds);
  await applyOrdersToDailyMetrics(tx, orderIds, -1);
}

/**
 * Crea un pedido PENDING al final de su columna. Precios y costos se copian
 * del catálogo en este momento (snapshot), junto con los totales del pedido.
 * Descuenta el stock; si algún producto no alcanza, no se crea nada.
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

    await activateOrders(tx, [order.id]);
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
 * stock + métricas, todo dentro de `tx`.
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

  // Stock y métricas solo cambian al entrar o salir de CANCELLED.
  if (current.status !== toStatus) {
    if (toStatus === OrderStatus.CANCELLED) await deactivateOrders(tx, [orderId]);
    else if (current.status === OrderStatus.CANCELLED) await activateOrders(tx, [orderId]);
  }

  return order;
}

/** Cancela un pedido, repone su stock y lo coloca al final de la columna CANCELLED. */
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

export type BulkUpdateResult = {
  /** Pedidos que cambiaron de estado, en su nuevo orden dentro de la columna. */
  updated: OrderSummary[];
  skipped: { alreadyInStatus: string[]; notFound: string[] };
};

/**
 * Bulk Update desde la tabla de pedidos (hasta 100). Mueve cada pedido al
 * final de la columna destino, respetando el orden en que se seleccionaron.
 * Es set-based: el número de consultas no crece con la cantidad de pedidos.
 *
 * - Los pedidos se bloquean con FOR UPDATE en orden de id. No se valida
 *   `version` (gana la última escritura), pero se incrementa: un Kanban
 *   abierto con la versión anterior recibirá VERSION_CONFLICT al arrastrar.
 * - Los que ya están en el estado destino o no existen se omiten y se
 *   reportan en `skipped`.
 * - Stock y métricas se ajustan para los que entran o salen de CANCELLED.
 *   Si al reactivar no alcanza el stock, se revierte todo el lote.
 */
export async function bulkUpdateStatus(
  { orderIds, status }: BulkUpdateData,
  actorId: string,
): Promise<BulkUpdateResult> {
  const ids = [...new Set(orderIds)];

  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; status: OrderStatus }[]>`
      SELECT "id", "status"
      FROM "orders"
      WHERE "id" = ANY(${ids}::uuid[])
      ORDER BY "id"
      FOR UPDATE
    `;
    const previousStatus = new Map(locked.map((row) => [row.id, row.status]));

    const notFound = ids.filter((id) => !previousStatus.has(id));
    const alreadyInStatus = ids.filter((id) => previousStatus.get(id) === status);
    const toMove = ids.filter((id) => previousStatus.has(id) && previousStatus.get(id) !== status);

    if (toMove.length === 0) return { updated: [], skipped: { alreadyInStatus, notFound } };

    const positions = positionsAfter(await lastPositionInColumn(tx, status), toMove.length);
    await tx.$executeRaw`
      UPDATE "orders" AS o SET
        "status" = ${status}::"order_status",
        "position" = v."position",
        "version" = o."version" + 1,
        "updated_at" = now()
      FROM unnest(${toMove}::uuid[], ${positions}::text[]) AS v("id", "position")
      WHERE o."id" = v."id"
    `;

    await tx.orderStatusEvent.createMany({
      data: toMove.map((orderId) => ({
        orderId,
        fromStatus: previousStatus.get(orderId)!,
        toStatus: status,
        actorId,
      })),
    });

    if (status === OrderStatus.CANCELLED) {
      await deactivateOrders(tx, toMove);
    } else {
      await activateOrders(
        tx,
        toMove.filter((id) => previousStatus.get(id) === OrderStatus.CANCELLED),
      );
    }

    const updated = await tx.order.findMany({
      where: { id: { in: toMove } },
      orderBy: { position: "asc" },
      select: orderSummarySelect,
    });

    return { updated, skipped: { alreadyInStatus, notFound } };
  }, TX_OPTIONS);
}
