import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import type { AnalyticsQuery } from "@/features/analytics/schemas";
import { averageTicketCents, grossMarginCents, grossMarginRatio } from "@/lib/finance";
import { db } from "@/server/db";

/** Tag de caché del resumen de KPIs. Toda mutación de pedidos lo revalida. */
export const ANALYTICS_CACHE_TAG = "analytics";

/** Zona horaria del día de negocio en daily_sales_metrics. */
export const BUSINESS_TIMEZONE = "America/Mexico_City";

type Totals = { ordersCount: number; revenueCents: number; costCents: number; itemsSold: number };

function withDerivedKpis(totals: Totals) {
  return {
    ...totals,
    grossMarginCents: grossMarginCents(totals.revenueCents, totals.costCents),
    grossMarginRatio: Number(grossMarginRatio(totals.revenueCents, totals.costCents).toFixed(4)),
    averageTicketCents: averageTicketCents(totals.revenueCents, totals.ordersCount),
  };
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
 *  - estados: GROUP BY status sobre orders. Ningún índice lo acelera (medido:
 *             ~57 ms con 500k pedidos, seq scan paralelo). Si se llega a
 *             millones de pedidos, sustituir por una tabla de contadores
 *             mantenida por trigger.
 */
export async function getSalesAnalytics({ page, limit }: AnalyticsQuery) {
  const [rows, aggregate, statusGroups] = await Promise.all([
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
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const ordersByStatus = Object.fromEntries(
    Object.values(OrderStatus).map((status) => [status, 0]),
  ) as Record<OrderStatus, number>;
  for (const group of statusGroups) ordersByStatus[group.status] = group._count._all;

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
