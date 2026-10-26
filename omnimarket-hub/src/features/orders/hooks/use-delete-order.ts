"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteOrder } from "@/features/orders/actions";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { mutationKeys, queryKeys } from "@/lib/query-keys";
import type { OrderList } from "@/server/dal/orders";

export type DeleteOrderVariables = { orderId: string; version: number; orderNumber: string };

/**
 * Eliminación optimista: la fila desaparece de todas las páginas cacheadas
 * de la tabla al confirmar; si el servidor falla se restaura el snapshot.
 * onSettled recarga tabla, Kanban y KPIs (cambian conteos, stock y métricas).
 */
export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.deleteOrder,
    mutationFn: async ({ orderId, version }: DeleteOrderVariables) =>
      unwrapAction(await deleteOrder({ orderId, version })),

    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.lists() });
      const snapshot = queryClient.getQueriesData<OrderList>({ queryKey: queryKeys.orders.lists() });

      queryClient.setQueriesData<OrderList>({ queryKey: queryKeys.orders.lists() }, (list) => {
        if (!list?.rows.some((row) => row.id === orderId)) return list;
        return {
          ...list,
          rows: list.rows.filter((row) => row.id !== orderId),
          pagination: { ...list.pagination, total: list.pagination.total - 1 },
        };
      });
      return { snapshot };
    },

    onError: (error, { orderNumber }, context) => {
      context?.snapshot.forEach(([key, data]: [QueryKey, OrderList | undefined]) => queryClient.setQueryData(key, data));
      toast.error(`No se pudo eliminar ${orderNumber}`, {
        description:
          error instanceof ActionFailure
            ? error.message
            : "Revisa tu conexión e inténtalo de nuevo. Se restauró el pedido.",
      });
    },

    onSuccess: (_, { orderNumber }) => {
      toast.success(`Pedido ${orderNumber} eliminado`, {
        description: "Se repuso su stock y se descontó de las métricas.",
      });
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanban.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
