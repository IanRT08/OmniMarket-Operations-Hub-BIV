import type { OrderStatus } from "@/generated/prisma/enums";
import { toBusinessDay } from "@/lib/dates";

export type OrderFilters = {
  /** Estados permitidos; vacío o ausente = todos. */
  statuses?: OrderStatus[];
  /** Primer día incluido, YYYY-MM-DD en hora de CDMX. */
  from?: string;
  /** Último día incluido, YYYY-MM-DD en hora de CDMX. */
  to?: string;
};

type FilterableOrder = { status: OrderStatus; createdAt: Date | string };

/**
 * Filtra pedidos por estado y rango de fechas (inclusivo). Las fechas se
 * comparan como día de negocio de CDMX, igual que daily_sales_metrics: un
 * pedido de las 21:30 en CDMX cuenta para ese día aunque en UTC ya sea el
 * siguiente.
 */
export function filterOrders<T extends FilterableOrder>(orders: T[], filters: OrderFilters): T[] {
  const { statuses, from, to } = filters;

  return orders.filter((order) => {
    if (statuses?.length && !statuses.includes(order.status)) return false;
    if (!from && !to) return true;

    // YYYY-MM-DD se ordena lexicográficamente igual que cronológicamente.
    const day = toBusinessDay(order.createdAt);
    return (!from || day >= from) && (!to || day <= to);
  });
}
