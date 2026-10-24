import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { fetchDashboardKpis } from "@/features/analytics/actions";
import type { DashboardRange } from "@/features/analytics/schemas";
import { queryKeys } from "@/lib/query-keys";

/** "Tiempo real" del dashboard: refresco periódico sobre la lectura cacheada. */
export const DASHBOARD_REFETCH_INTERVAL_MS = 30_000;

/**
 * Compartidas por el prefetch del RSC (dashboard/page.tsx) y useQuery.
 * keepPreviousData: al cambiar de rango, las gráficas conservan su dibujo
 * (atenuado) mientras llega el nuevo, sin saltos de layout.
 */
export const dashboardKpisQueryOptions = (days: DashboardRange) =>
  queryOptions({
    queryKey: queryKeys.analytics.dashboard(days),
    queryFn: () => fetchDashboardKpis(days),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
  });
