import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import type { AnalyticsQuery } from "@/features/analytics/schemas";
import { BUSINESS_TIMEZONE } from "@/lib/dates";
import { averageTicketCents, grossMarginCents, grossMarginRatio } from "@/lib/finance";
import { db } from "@/server/db";

/** Tag de caché del resumen de KPIs. Toda mutación de pedidos lo revalida. */
export const ANALYTICS_CACHE_TAG = "analytics";

export type Totals = { ordersCount: number; revenueCents: number; costCents: number; itemsSold: number };

export function withDerivedKpis(totals: Totals) {
  return {
    ...totals,
    grossMarginCents: grossMarginCents(totals.revenueCents, totals.costCents),
    grossMarginRatio: Number(grossMarginRatio(totals.revenueCents, totals.costCents).toFixed(4)),
    averageTicketCents: averageTicketCents(totals.revenueCents, totals.ordersCount),
  };
}

/**
 * Pedidos por estado (columna del Kanban), con 0 para los estados vacíos.
 * GROUP BY status sobre orders: ningún índice lo acelera (medido: ~57 ms con
 * 500k pedidos, seq scan paralelo). Si se llega a millones de pedidos,
 * sustituir por una tabla de contadores mantenida por trigger.
 */
export async function countOrdersByStatus(): Promise<Record<OrderStatus, number>> {
  const groups = await db.order.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const group of groups) counts[group.status] = group._count._all;
  return counts;
}

/**
 * Página de métricas diarias + resumen global + conteo por estado.
 *
 * Nunca hace SUM sobre `orders`: lee `daily_sales_metrics` (≈365 filas/año),
 * que se mantiene en la misma transacción que crea o cancela pedidos.
 * Las 3 consultas van en paralelo (el pool necesita ≥ 3 conexiones):
 *  - página:  ORDER BY day DESC LIMIT/OFFSET → Index Scan Backward sobre la PK.
 *  - resumen: COUNT + SUM sobre la tabla pre-agregada; el total de la
 *             paginación sale del conteo de días, no de COUNT(*) sobre orders.
 *  - estados: countOrdersByStatus().
 */
export async function getSalesAnalytics({ page, limit }: AnalyticsQuery) {
  const [rows, aggregate, ordersByStatus] = await Promise.all([
    db.dailySalesMetric.findMany({
      orderBy: { day: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: { day: true, ordersCount: true, revenueCents: true, costCents: true, itemsSold: true },
    }),
    db.dailySalesMetric.aggregate({
      _count: { _all: true },
      _sum: { ordersCount: true, revenueCents: true, costCents: true, itemsSold: true },
    }),
    countOrdersByStatus(),
  ]);

  const totalDays = aggregate._count._all;
  const totalPages = Math.ceil(totalDays / limit);

  return {
    data: rows.map(({ day, ...totals }) => ({
      day: day.toISOString().slice(0, 10), // @db.Date llega como medianoche UTC
      ...withDerivedKpis(totals),
    })),
    summary: {
      days: totalDays,
      ...withDerivedKpis({
        ordersCount: aggregate._sum.ordersCount ?? 0,
        revenueCents: aggregate._sum.revenueCents ?? 0,
        costCents: aggregate._sum.costCents ?? 0,
        itemsSold: aggregate._sum.itemsSold ?? 0,
      }),
      ordersByStatus,
    },
    pagination: {
      page,
      limit,
      total: totalDays,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  };
}

export type SalesAnalytics = Awaited<ReturnType<typeof getSalesAnalytics>>;

/**
 * Suma (+1) o resta (−1) pedidos en la fila de su día de negocio. Debe
 * llamarse con el `tx` de la misma transacción que crea los pedidos o cambia
 * su estado desde/hacia CANCELLED, así métricas y pedidos nunca divergen.
 * Lee totales y partidas de la BD, por lo que los pedidos y sus order_items
 * ya deben existir dentro de `tx`. Varios pedidos del mismo día se agregan
 * en una sola operación sobre esa fila.
 *
 * - +1 usa upsert: el primer pedido del día crea la fila.
 * - −1 usa UPDATE: en un INSERT … ON CONFLICT, Postgres evalúa los CHECK
 *   (>= 0) sobre la fila propuesta *antes* de detectar el conflicto, así que
 *   un upsert con valores negativos fallaría aunque la fila exista.
 * Ambos son atómicos a nivel de fila: dos transacciones simultáneas del
 * mismo día se serializan en el lock de esa fila, sin perder incrementos.
 */
export async function applyOrdersToDailyMetrics(
  tx: Prisma.TransactionClient,
  orderIds: string[],
  direction: 1 | -1,
): Promise<void> {
  if (orderIds.length === 0) return;

  if (direction === 1) {
    await tx.$executeRaw`
      INSERT INTO "daily_sales_metrics" AS m
        ("day", "orders_count", "revenue_cents", "cost_cents", "items_sold", "updated_at")
      SELECT
        (o."created_at" AT TIME ZONE ${BUSINESS_TIMEZONE}::text)::date,
        COUNT(*)::int,
        SUM(o."total_cents")::int,
        SUM(o."cost_cents")::int,
        COALESCE(SUM(i."items"), 0)::int,
        now()
      FROM "orders" o
      LEFT JOIN (
        SELECT "order_id", SUM("quantity") AS "items"
        FROM "order_items"
        WHERE "order_id" = ANY(${orderIds}::uuid[])
        GROUP BY "order_id"
      ) i ON i."order_id" = o."id"
      WHERE o."id" = ANY(${orderIds}::uuid[])
      GROUP BY 1
      ON CONFLICT ("day") DO UPDATE SET
        "orders_count"  = m."orders_count"  + EXCLUDED."orders_count",
        "revenue_cents" = m."revenue_cents" + EXCLUDED."revenue_cents",
        "cost_cents"    = m."cost_cents"    + EXCLUDED."cost_cents",
        "items_sold"    = m."items_sold"    + EXCLUDED."items_sold",
        "updated_at"    = EXCLUDED."updated_at"
    `;
    return;
  }

  const [result] = await tx.$queryRaw<{ expected: number; updated: number }[]>`
    WITH "delta" AS (
      SELECT
        (o."created_at" AT TIME ZONE ${BUSINESS_TIMEZONE}::text)::date AS "day",
        COUNT(*)::int AS "orders",
        SUM(o."total_cents")::int AS "revenue",
        SUM(o."cost_cents")::int AS "cost",
        COALESCE(SUM(i."items"), 0)::int AS "items"
      FROM "orders" o
      LEFT JOIN (
        SELECT "order_id", SUM("quantity") AS "items"
        FROM "order_items"
        WHERE "order_id" = ANY(${orderIds}::uuid[])
        GROUP BY "order_id"
      ) i ON i."order_id" = o."id"
      WHERE o."id" = ANY(${orderIds}::uuid[])
      GROUP BY 1
    ), "updated" AS (
      UPDATE "daily_sales_metrics" AS m SET
        "orders_count"  = m."orders_count"  - d."orders",
        "revenue_cents" = m."revenue_cents" - d."revenue",
        "cost_cents"    = m."cost_cents"    - d."cost",
        "items_sold"    = m."items_sold"    - d."items",
        "updated_at"    = now()
      FROM "delta" d
      WHERE m."day" = d."day"
      RETURNING m."day"
    )
    SELECT
      (SELECT COUNT(*) FROM "delta")::int AS "expected",
      (SELECT COUNT(*) FROM "updated")::int AS "updated"
  `;

  // Si falta la fila de algún día, la tabla ya estaba desincronizada. Se deja
  // pasar la mutación del usuario y se avisa: rebuildDailySalesMetrics la repara.
  if (result && result.updated < result.expected) {
    console.warn(
      `[metrics] faltan ${result.expected - result.updated} fila(s) de daily_sales_metrics al restar pedidos`,
    );
  }
}

/**
 * Reconstruye daily_sales_metrics completo desde orders/order_items con un
 * único INSERT … SELECT. Excluye pedidos CANCELLED y agrupa por día de CDMX.
 * Pensado para el seed/reset o para reparar la tabla; el flujo normal de la
 * UI la actualiza incrementalmente dentro de su propia transacción.
 *
 * @returns número de días (filas) generados.
 */
export async function rebuildDailySalesMetrics(tx: Prisma.TransactionClient): Promise<number> {
  await tx.$executeRaw`DELETE FROM "daily_sales_metrics"`;

  return tx.$executeRaw`
    INSERT INTO "daily_sales_metrics"
      ("day", "orders_count", "revenue_cents", "cost_cents", "items_sold", "updated_at")
    SELECT
      (o."created_at" AT TIME ZONE ${BUSINESS_TIMEZONE}::text)::date AS "day",
      COUNT(*)::int,
      SUM(o."total_cents")::int,
      SUM(o."cost_cents")::int,
      COALESCE(SUM(i."items"), 0)::int,
      now()
    FROM "orders" o
    LEFT JOIN (
      SELECT "order_id", SUM("quantity") AS "items"
      FROM "order_items"
      GROUP BY "order_id"
    ) i ON i."order_id" = o."id"
    WHERE o."status" <> 'CANCELLED'
    GROUP BY 1
  `;
}
