"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { moveOrder } from "@/features/kanban/actions";
import type { OrderStatus } from "@/generated/prisma/enums";
import { ActionFailure, unwrapAction } from "@/lib/action-result";
import { applyCardMove, findCard } from "@/lib/kanban-board";
import { statusLabel } from "@/lib/order-status";
import { mutationKeys, queryKeys } from "@/lib/query-keys";
import type { KanbanBoard } from "@/server/dal/orders";

export type MoveOrderVariables = {
  orderId: string;
  orderNumber: string;
  toStatus: OrderStatus;
  position: string;
  /** Versión que el cliente vio: el servidor rechaza el movimiento si cambió. */
  version: number;
  /** Estado previo de la tarjeta, para revertir solo esta tarjeta si falla. */
  from: { status: OrderStatus; position: string; version: number };
};

function describeError(error: unknown, orderNumber: string) {
  if (error instanceof ActionFailure) {
    switch (error.code) {
      case "VERSION_CONFLICT":
        return {
          title: `Otro usuario movió ${orderNumber}`,
          description: "Se revirtió tu cambio y se cargó el estado actual del tablero.",
        };
      case "INSUFFICIENT_STOCK":
        return { title: `No hay stock para reactivar ${orderNumber}`, description: error.message };
      case "ORDER_NOT_FOUND":
        return { title: `El pedido ${orderNumber} ya no existe`, description: "Se actualizó el tablero." };
      default:
        return { title: `No se pudo mover ${orderNumber}`, description: error.message };
    }
  }
  return {
    title: `No se pudo mover ${orderNumber}`,
    description: "Revisa tu conexión e inténtalo de nuevo. El pedido volvió a su lugar.",
  };
}

/**
 * Mutación optimista del Kanban.
 *
 * 1. move(): cancela refetch en curso y escribe el movimiento en el cache
 *    ANTES de llamar al servidor (version + 1, como hará el UPDATE).
 * 2. onSuccess: toast de confirmación.
 * 3. onError: rollback visual de ESA tarjeta (no del tablero completo, para
 *    no deshacer otros movimientos optimistas en curso) + toast.
 * 4. onSettled: cuando ya no queda ningún movimiento pendiente, vuelve a
 *    consultar la BD para que el tablero refleje el estado real (incluye
 *    los cambios de otros usuarios que provocaron un conflicto).
 *
 * Las Server Actions de un cliente se ejecutan en serie, así que dos
 * arrastres rápidos de la misma tarjeta usan versiones consecutivas válidas.
 */
export function useMoveOrder() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: mutationKeys.moveOrder,
    mutationFn: async ({ orderId, toStatus, position, version }: MoveOrderVariables) =>
      unwrapAction(await moveOrder({ orderId, toStatus, position, version })),

    // El cache ya tiene estado, posición y versión del servidor (el optimista
    // usó los mismos valores). No se reescribe: pisaría un segundo arrastre
    // de la misma tarjeta que siga en curso.
    onSuccess: (order, { orderNumber, from }) => {
      toast.success(
        order.status === from.status
          ? `${orderNumber} reordenado en ${statusLabel(order.status)}`
          : `${orderNumber} movido a ${statusLabel(order.status)}`,
      );
    },

    onError: (error, { orderId, orderNumber, version, from }) => {
      // Rollback solo si el cache aún muestra ESTE movimiento. Si hubo otro
      // arrastre posterior de la misma tarjeta, la consulta de onSettled trae
      // el estado real de la BD.
      queryClient.setQueryData<KanbanBoard>(queryKeys.kanban.board(), (board) =>
        board && findCard(board, orderId)?.version === version + 1
          ? applyCardMove(board, { orderId, toStatus: from.status, position: from.position, version: from.version })
          : board,
      );
      const { title, description } = describeError(error, orderNumber);
      toast.error(title, { description });
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: mutationKeys.moveOrder }) === 1) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.kanban.board() });
      }
    },
  });

  const { mutate } = mutation;

  /**
   * Aplica el movimiento optimista y lo envía. La promesa se resuelve cuando
   * el cache ya refleja el cambio (no cuando responde el servidor): el
   * tablero puede soltar su vista previa de arrastre sin que la tarjeta
   * "rebote" a su columna original durante un frame.
   */
  const move = useCallback(
    async (variables: MoveOrderVariables) => {
      // Un refetch que termine después sobrescribiría el cambio optimista.
      await queryClient.cancelQueries({ queryKey: queryKeys.kanban.board() });
      queryClient.setQueryData<KanbanBoard>(queryKeys.kanban.board(), (board) =>
        board
          ? applyCardMove(board, {
              orderId: variables.orderId,
              toStatus: variables.toStatus,
              position: variables.position,
              version: variables.version + 1,
            })
          : board,
      );
      mutate(variables);
    },
    [mutate, queryClient],
  );

  return { move };
}
