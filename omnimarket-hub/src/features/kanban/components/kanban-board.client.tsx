"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useIsMutating, useMutationState, useQuery } from "@tanstack/react-query";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMoveOrder, type MoveOrderVariables } from "@/features/kanban/hooks/use-move-order";
import { KANBAN_REFETCH_INTERVAL_MS, kanbanBoardQueryOptions } from "@/features/kanban/queries";
import {
  boardToColumnIds,
  findColumn,
  moveAcrossColumns,
  positionForIndex,
  reorderWithinColumn,
  type ColumnIds,
} from "@/lib/kanban-board";
import { ORDER_STATUS_FLOW, statusLabel } from "@/lib/order-status";
import { mutationKeys } from "@/lib/query-keys";
import type { KanbanCard } from "@/server/dal/orders";
import { KanbanColumn } from "./kanban-column.client";
import { KanbanBoardSkeleton } from "./kanban-skeleton";
import { OrderCard } from "./order-card";

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para mover un pedido, presiona Espacio o Enter. Usa las flechas para cambiarlo de columna o de lugar, " +
    "Espacio o Enter para soltarlo y Escape para cancelar.",
};

export function KanbanBoard() {
  const { move } = useMoveOrder();
  const isMoving = useIsMutating({ mutationKey: mutationKeys.moveOrder }) > 0;

  // Vista previa local durante el arrastre (solo IDs). null = se pinta el cache.
  const [preview, setPreview] = useState<ColumnIds | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: board, isPending, isError, isFetching, refetch } = useQuery({
    ...kanbanBoardQueryOptions(),
    // No se refresca mientras hay un arrastre o un movimiento sin confirmar:
    // la respuesta podría ser anterior al UPDATE y "devolver" la tarjeta.
    refetchInterval: activeId || isMoving ? false : KANBAN_REFETCH_INTERVAL_MS,
  });

  // Tarjetas cuyo movimiento aún no confirma el servidor (indicador "guardando").
  const savingIds = new Set(
    useMutationState({
      filters: { mutationKey: mutationKeys.moveOrder, status: "pending" },
      select: (mutation) => (mutation.state.variables as MoveOrderVariables | undefined)?.orderId,
    }).filter((id): id is string => Boolean(id)),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cardsById = useMemo(() => {
    const map = new Map<string, KanbanCard>();
    board?.columns.forEach((column) => column.cards.forEach((card) => map.set(card.id, card)));
    return map;
  }, [board]);

  const columnIds = useMemo(() => preview ?? (board ? boardToColumnIds(board) : null), [preview, board]);

  if (isPending) return <KanbanBoardSkeleton />;

  if (isError && !board) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-white p-10 text-center">
        <TriangleAlert className="size-8 text-rose-600" aria-hidden="true" />
        <p className="font-medium text-ink">No se pudo cargar el tablero.</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="size-4" aria-hidden="true" /> Reintentar
        </Button>
      </div>
    );
  }

  if (!board || !columnIds) return null;

  const columnName = (id: string | number) => {
    const status = findColumn(columnIds, String(id));
    return status ? statusLabel(status) : "";
  };
  const orderName = (id: string | number) => cardsById.get(String(id))?.orderNumber ?? "";

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste el pedido ${orderName(active.id)} de ${columnName(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `Pedido ${orderName(active.id)} sobre la columna ${columnName(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Pedido ${orderName(active.id)} soltado en ${columnName(over.id)}.` : `Pedido ${orderName(active.id)} soltado.`,
    onDragCancel: ({ active }) => `Movimiento cancelado. ${orderName(active.id)} volvió a su lugar.`,
  };

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setPreview(boardToColumnIds(board!));
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setPreview((current) => (current ? moveAcrossColumns(current, String(active.id), String(over.id)) : current));
  }

  function handleDragCancel() {
    setActiveId(null);
    setPreview(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const cardId = String(active.id);
    const card = cardsById.get(cardId);
    setActiveId(null);

    if (!over || !preview || !card) {
      setPreview(null);
      return;
    }

    const finalColumns = reorderWithinColumn(preview, cardId, String(over.id));
    const toStatus = findColumn(finalColumns, cardId)!;
    const index = finalColumns[toStatus].indexOf(cardId);

    const originalIndex = board!.columns.find((c) => c.status === card.status)!.cards.findIndex((c) => c.id === cardId);
    if (toStatus === card.status && index === originalIndex) {
      setPreview(null); // se soltó donde estaba
      return;
    }

    // Mantiene la vista previa en la posición final hasta que el cache tenga
    // el cambio optimista; luego el tablero vuelve a pintarse desde el cache.
    setPreview(finalColumns);

    const neighbors = finalColumns[toStatus].filter((id) => id !== cardId).map((id) => cardsById.get(id)!);
    void move({
      orderId: card.id,
      orderNumber: card.orderNumber,
      toStatus,
      position: positionForIndex(neighbors, index),
      version: card.version,
      from: { status: card.status, position: card.position, version: card.version },
    }).finally(() => setPreview(null));
  }

  const activeCard = activeId ? cardsById.get(activeId) : undefined;
  const activeColumn = activeId ? findColumn(columnIds, activeId) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-8 items-center justify-end gap-3 text-xs text-ink-muted">
        <span aria-live="polite">{isFetching ? "Actualizando…" : "Se actualiza automáticamente"}</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Actualizar tablero">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Actualizar
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements, screenReaderInstructions }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ORDER_STATUS_FLOW.map((status) => {
            const column = board.columns.find((c) => c.status === status)!;
            const cards = columnIds[status].map((id) => cardsById.get(id)).filter((c): c is KanbanCard => Boolean(c));
            // Mientras se previsualiza, el total refleja la tarjeta que entra o sale.
            const total = column.total + (cards.length - column.cards.length);
            return (
              <KanbanColumn
                key={status}
                status={status}
                cards={cards}
                total={total}
                isActiveTarget={activeColumn === status}
                savingIds={savingIds}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {activeCard ? <OrderCard card={activeCard} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
