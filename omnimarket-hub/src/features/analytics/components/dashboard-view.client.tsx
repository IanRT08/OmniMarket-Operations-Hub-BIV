"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dashboardKpisQueryOptions } from "@/features/analytics/queries";
import {
  DASHBOARD_DEFAULT_RANGE,
  DASHBOARD_RANGES,
  parseDashboardRange,
  type DashboardRange,
} from "@/features/analytics/schemas";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnalyticsSkeleton } from "./analytics-skeleton";
import { KpiCards } from "./kpi-cards";
import { OrdersByStatus } from "./orders-by-status";
import { SalesChart } from "./sales-chart.client";

export function DashboardView() {
  const searchParams = useSearchParams();
  const days = parseDashboardRange(searchParams.get("days") ?? undefined);
  const { data, isPending, isError, isPlaceholderData, isFetching, dataUpdatedAt, refetch } = useQuery(
    dashboardKpisQueryOptions(days),
  );

  // El rango vive en la URL (?days=7), sin volver a renderizar en el servidor.
  function selectRange(next: DashboardRange) {
    const params = new URLSearchParams(searchParams);
    if (next === DASHBOARD_DEFAULT_RANGE) params.delete("days");
    else params.set("days", String(next));
    window.history.replaceState(null, "", params.size > 0 ? `?${params}` : window.location.pathname);
  }

  if (isPending) return <AnalyticsSkeleton />;

  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-white p-10 text-center">
        <TriangleAlert className="size-8 text-rose-600" aria-hidden="true" />
        <p className="font-medium text-ink">No se pudieron cargar los indicadores.</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="size-4" aria-hidden="true" /> Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Una sola fila de filtros, arriba de todo lo que afecta. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Rango de fechas" className="inline-flex rounded-lg border border-border bg-white p-0.5">
          {DASHBOARD_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={range === days}
              onClick={() => selectRange(range)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                range === days ? "bg-brand-moss text-white" : "text-ink-muted hover:bg-brand-mint/40 hover:text-ink",
              )}
            >
              Últimos {range} días
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted" aria-live="polite">
          {isFetching ? "Actualizando…" : `Actualizado a las ${formatTime(dataUpdatedAt)} · se refresca cada 30 s`}
        </p>
      </div>

      {/* Al cambiar de rango se conserva el dibujo anterior, atenuado, hasta que
          llegan los datos nuevos: sin parpadeo ni salto de layout. */}
      <div
        aria-busy={isPlaceholderData}
        className={cn("flex flex-col gap-6 transition-opacity", isPlaceholderData && "opacity-50")}
      >
        <KpiCards summary={data.summary} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesChart series={data.series} range={data.range} />
          </div>
          <OrdersByStatus counts={data.ordersByStatus} />
        </div>
      </div>
    </div>
  );
}
