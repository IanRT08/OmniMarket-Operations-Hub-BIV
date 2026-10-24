import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { ORDER_STATUS_FLOW, ORDER_STATUS_META } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/server/dal/dashboard";

/**
 * Pedidos por estado: comparar magnitudes de categorías nominales → barras de
 * UN solo color (olive), valor en la punta. La identidad del estado la lleva
 * el punto de color junto a la etiqueta (el mismo del Kanban), nunca el texto
 * ni la barra. Cada fila abre la tabla de pedidos filtrada por ese estado.
 */
export function OrdersByStatus({ counts }: { counts: DashboardKpis["ordersByStatus"] }) {
  const total = ORDER_STATUS_FLOW.reduce((sum, status) => sum + counts[status], 0);
  const max = Math.max(1, ...ORDER_STATUS_FLOW.map((status) => counts[status]));

  return (
    <section className="flex flex-col rounded-xl border border-border bg-white p-5" aria-labelledby="by-status-title">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 id="by-status-title" className="text-base font-semibold text-ink">
            Pedidos por estado
          </h2>
          <p className="text-xs text-ink-muted">Estado actual · {formatNumber(total)} pedidos en total</p>
        </div>
        <Link href="/kanban" className="text-xs font-medium text-brand-moss underline-offset-4 hover:underline">
          Ver tablero
        </Link>
      </div>

      <ul className="flex flex-1 flex-col justify-around gap-3">
        {ORDER_STATUS_FLOW.map((status) => {
          const meta = ORDER_STATUS_META[status];
          const count = counts[status];
          return (
            <li key={status} data-testid={`status-count-${status}`}>
              <Link
                href={`/orders?status=${status}`}
                className="group grid grid-cols-[6.5rem_1fr] items-center gap-3 rounded-md py-1 focus-visible:outline-2"
                aria-label={`${meta.label}: ${formatNumber(count)} pedidos. Ver en la tabla`}
              >
                <span className="flex items-center gap-2 text-sm text-ink">
                  <span className={cn("size-2.5 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 flex-1 overflow-hidden" aria-hidden="true">
                    <span
                      className="block h-full rounded-r-[4px] bg-brand-olive transition-colors group-hover:bg-brand-lime"
                      style={{ width: `${(count / max) * 100}%`, minWidth: count > 0 ? 4 : 0 }}
                    />
                  </span>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums text-ink">{formatNumber(count)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
