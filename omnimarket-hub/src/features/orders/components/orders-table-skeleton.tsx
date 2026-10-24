import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

// Anchos por columna (selección, pedido, cliente, estado, artículos, total, fecha).
const CELL_WIDTHS = ["w-4", "w-28", "w-40", "w-20", "w-8", "w-20", "w-32"];

/** Filas de carga con la misma estructura que las reales (mismo alto de fila). */
export function OrderRowsSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} aria-hidden="true">
          {CELL_WIDTHS.map((width, cell) => (
            <TableCell key={cell} className="py-[1.15rem]">
              <Skeleton className={`h-4 ${width}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Estado de carga completo de /orders: filtros + tabla + paginación. */
export function OrdersTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando pedidos" className="flex flex-col gap-4">
      {/* Misma geometría que OrdersFilters: etiqueta + campo, y fila de chips. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {["w-72", "w-40", "w-40"].map((width, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-14" />
              <Skeleton className={`h-10 ${width}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="h-11 bg-brand-mint/30" />
        <table className="w-full">
          <tbody>
            <OrderRowsSkeleton rows={rows} />
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-56" />
      </div>
      <span className="sr-only">Cargando pedidos…</span>
    </div>
  );
}
