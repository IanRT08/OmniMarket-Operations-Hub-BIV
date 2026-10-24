import { Skeleton } from "@/components/ui/skeleton";

/** Carga inicial del dashboard: misma geometría que DashboardView (sin saltos). */
export function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Cargando indicadores" className="flex flex-col gap-6">
      <div className="flex h-9 items-center justify-between gap-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-3 w-40" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-36" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5 lg:col-span-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-3 w-56" />
          {/* Columnas de alturas variadas en vez de un bloque plano. */}
          <div className="mt-4 flex h-72 items-end gap-2 border-b border-border pb-1">
            {[40, 65, 30, 80, 55, 70, 45, 90, 60, 35, 75, 50, 85, 40, 65].map((height, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-[4px] rounded-b-none" style={{ height: `${height}%` }} />
            ))}
          </div>
          <Skeleton className="mt-3 h-4 w-32" />
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-48" />
          <div className="mt-6 flex flex-col gap-5">
            {[85, 70, 55, 100, 30].map((width, i) => (
              <div key={i} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando indicadores…</span>
    </div>
  );
}
