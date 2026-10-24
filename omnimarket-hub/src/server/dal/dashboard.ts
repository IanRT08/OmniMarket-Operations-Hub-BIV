import "server-only";

import { unstable_cache } from "next/cache";
import { addDays, toBusinessDay } from "@/lib/dates";
import { ANALYTICS_CACHE_TAG, countOrdersByStatus, withDerivedKpis, type Totals } from "@/server/dal/analytics";
import { db } from "@/server/db";

export const DASHBOARD_DEFAULT_DAYS = 30;

const EMPTY_TOTALS: Totals = { ordersCount: 0, revenueCents: 0, costCents: 0, itemsSold: 0 };

/**
 * KPIs del dashboard: resumen del periodo, serie diaria para la gráfica y
 * pedidos por estado. Solo lee daily_sales_metrics (pre-agregada) más el
 * GROUP BY por estado.
 *
 * La ventana de `days` termina en el último día con ventas, no en "hoy": en
 * operación normal es el mismo día, y con el seed estático (fechas fijas de
 * sep–oct 2026) la gráfica sigue mostrando datos meses después. `range`
 * devuelve las fechas exactas para rotular la UI.
 *
 * El resultado es JSON puro (fechas como YYYY-MM-DD) porque unstable_cache
 * lo serializa.
 */
export async function getDashboardKpis(days: number = DASHBOARD_DEFAULT_DAYS) {
  const latest = await db.dailySalesMetric.findFirst({ orderBy: { day: "desc" }, select: { day: true } });
  const to = latest ? latest.day.toISOString().slice(0, 10) : toBusinessDay(new Date());
  const from = addDays(to, -(days - 1));

  const [rows, ordersByStatus] = await Promise.all([
    db.dailySalesMetric.findMany({
      where: { day: { gte: new Date(from), lte: new Date(to) } },
      orderBy: { day: "asc" },
      select: { day: true, ordersCount: true, revenueCents: true, costCents: true, itemsSold: true },
    }),
    countOrdersByStatus(),
  ]);

  // Serie continua: los días sin ventas van en 0 para que la gráfica no
  // comprima los huecos.
  const byDay = new Map(rows.map(({ day, ...totals }) => [day.toISOString().slice(0, 10), totals]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    return { day, ...withDerivedKpis(byDay.get(day) ?? EMPTY_TOTALS) };
  });

  const periodTotals = rows.reduce<Totals>(
    (sum, row) => ({
      ordersCount: sum.ordersCount + row.ordersCount,
      revenueCents: sum.revenueCents + row.revenueCents,
      costCents: sum.costCents + row.costCents,
      itemsSold: sum.itemsSold + row.itemsSold,
    }),
    EMPTY_TOTALS,
  );

  return {
    range: { from, to, days },
    summary: withDerivedKpis(periodTotals),
    series,
    ordersByStatus,
  };
}

export type DashboardKpis = Awaited<ReturnType<typeof getDashboardKpis>>;

/**
 * Versión cacheada para el RSC del dashboard, con el tag `analytics`: toda
 * Server Action que crea, cancela o mueve pedidos llama a
 * revalidateTag('analytics', { expire: 0 }) y la siguiente lectura va a la BD.
 * `revalidate` es solo una red de seguridad por si alguna mutación futura
 * olvida invalidar.
 *
 * Next 16 recomienda `"use cache"` + cacheTag, pero exige cacheComponents,
 * que es incompatible con `dynamic = "force-dynamic"` (kanban-status) y con
 * leer la sesión arriba del layout. Migrar = reemplazar esta función.
 */
export const getCachedDashboardKpis = unstable_cache(getDashboardKpis, ["dashboard-kpis"], {
  tags: [ANALYTICS_CACHE_TAG],
  revalidate: 300,
});
