"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { bulkUpdateStatus } from "@/features/orders/actions";
import type { OrderStatus } from "@/generated/prisma/enums";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { statusLabel } from "@/lib/order-status";
import { mutationKeys, queryKeys } from "@/lib/query-keys";
import type { OrderList } from "@/server/dal/orders";

export type BulkUpdateVariables = { orderIds: string[]; status: OrderStatus };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Bulk Update optimista.
 * onMutate: cambia el estado de las filas seleccionadas en TODAS las páginas
 * cacheadas de la tabla (guardando un snapshot). onError: restaura el
 * snapshot + toast. onSuccess: toast con el resumen (actualizados/omitidos).
 * onSettled: recarga la tabla y el Kanban desde la BD (el estado cambió en
 * ambos y los filtros por estado pueden excluir ahora algunas filas).
 */
export function useBulkUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.bulkUpdate,
    mutationFn: async (variables: BulkUpdateVariables) => unwrapAction(await bulkUpdateStatus(variables)),

    onMutate: async ({ orderIds, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.lists() });
      const snapshot = queryClient.getQueriesData<OrderList>({ queryKey: queryKeys.orders.lists() });

      const selected = new Set(orderIds);
      queryClient.setQueriesData<OrderList>({ queryKey: queryKeys.orders.lists() }, (list) =>
        list && {
          ...list,
          rows: list.rows.map((row) => (selected.has(row.id) ? { ...row, status } : row)),
        },
      );
      return { snapshot };
    },

    onError: (error, { orderIds }, context) => {
      context?.snapshot.forEach(([key, data]: [QueryKey, OrderList | undefined]) => queryClient.setQueryData(key, data));
      toast.error(`No se pudieron actualizar ${plural(orderIds.length, "pedido", "pedidos")}`, {
        description:
          error instanceof ActionFailure
            ? error.message
            : "Revisa tu conexión e inténtalo de nuevo. Se restauró el estado anterior.",
      });
    },

    onSuccess: ({ updated, skipped }, { status }) => {
      const notes = [
        skipped.alreadyInStatus.length > 0 &&
          `${plural(skipped.alreadyInStatus.length, "ya estaba", "ya estaban")} en ${statusLabel(status)}`,
        skipped.notFound.length > 0 && `${plural(skipped.notFound.length, "ya no existe", "ya no existen")}`,
      ].filter(Boolean);

      const title =
        updated.length > 0
          ? `${plural(updated.length, "pedido movido", "pedidos movidos")} a ${statusLabel(status)}`
          : "No hubo cambios";
      toast.success(title, notes.length > 0 ? { description: notes.join(" · ") } : undefined);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanban.all });
    },
  });
}
