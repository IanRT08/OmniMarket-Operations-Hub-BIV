"use server";

import { dashboardRangeSchema, type DashboardRange } from "@/features/analytics/schemas";
import { getCachedDashboardKpis, type DashboardKpis } from "@/server/dal/dashboard";
import { requireSession } from "@/server/session";

/**
 * KPIs del dashboard para TanStack Query (prefetch del RSC y refetch
 * periódico). Lee la versión cacheada con el tag `analytics`: el sondeo cada
 * 30 s no golpea la BD, y cualquier mutación de pedidos invalida el tag.
 */
export async function fetchDashboardKpis(days: DashboardRange): Promise<DashboardKpis> {
  await requireSession();
  return getCachedDashboardKpis(dashboardRangeSchema.parse(days));
}
