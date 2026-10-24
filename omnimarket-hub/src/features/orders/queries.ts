import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { fetchOrders } from "@/features/orders/actions";
import type { OrderListQuery } from "@/features/orders/schemas";
import { queryKeys } from "@/lib/query-keys";

/**
 * Opciones compartidas por el prefetch del RSC (orders/page.tsx) y useQuery.
 * `query` debe venir de parseOrderListQuery para que la llave coincida.
 * keepPreviousData: al cambiar de página o filtro la tabla no se vacía; la
 * UI muestra filas skeleton encima mientras llega la nueva página.
 */
export const ordersListQueryOptions = (query: OrderListQuery) =>
  queryOptions({
    queryKey: queryKeys.orders.list(query),
    queryFn: () => fetchOrders(query),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
