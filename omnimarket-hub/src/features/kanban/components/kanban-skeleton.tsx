import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUS_FLOW, ORDER_STATUS_META } from "@/lib/order-status";
import { cn } from "@/lib/utils";

// Tarjetas por columna en el esqueleto: varía para que no se vea como una rejilla rígida.
const PLACEHOLDER_CARDS = [4, 3, 3, 2, 1];

/**
 * Estado de carga del tablero. Reproduce la estructura real (barra de
 * actualización y 5 columnas con su encabezado y acento de color) para que
 * no haya salto de layout al llegar los datos. Lo usan kanban/loading.tsx y
 * KanbanBoard mientras no hay datos en el cache.
 */
export function KanbanBoardSkeleton() {
  return (
    <div role="status" aria-label="Cargando tablero" className="flex flex-col gap-3">
      {/* Misma altura que la barra "Actualizar" del tablero real. */}
      <div className="flex h-8 items-center justify-end gap-3">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {ORDER_STATUS_FLOW.map((status, columnIndex) => (
          <div
            key={status}
            className={cn(
              "flex min-w-64 flex-1 basis-0 flex-col rounded-xl border border-t-4 border-border bg-white/60",
              ORDER_STATUS_META[status].accent,
            )}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="flex flex-col gap-2 px-2 pb-3">
              {Array.from({ length: PLACEHOLDER_CARDS[columnIndex] }, (_, i) => (
                <div key={i} className="rounded-lg border border-border bg-white p-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-36" />
                  <div className="mt-3 flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Cargando tablero de pedidos…</span>
    </div>
  );
}
