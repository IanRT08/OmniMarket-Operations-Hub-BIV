"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { OrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_META } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import type { KanbanCard } from "@/server/dal/orders";
import { SortableOrderCard } from "./sortable-order-card.client";

type KanbanColumnProps = {
  status: OrderStatus;
  cards: KanbanCard[];
  /** Total real en la BD (la columna puede venir truncada). */
  total: number;
  /** La tarjeta arrastrada está sobre esta columna. */
  isActiveTarget: boolean;
  savingIds: Set<string>;
};

const countFormatter = new Intl.NumberFormat("es-MX");

/**
 * Columna = droppable (para soltar en columnas vacías o al final) +
 * SortableContext (reordenamiento vertical entre sus tarjetas).
 */
export function KanbanColumn({ status, cards, total, isActiveTarget, savingIds }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status, data: { type: "column" } });
  const meta = ORDER_STATUS_META[status];
  const truncated = total > cards.length;
  const headingId = `kanban-column-${status}-heading`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-testid={`kanban-column-${status}`}
      className={cn(
        "flex max-h-[calc(100vh-13rem)] min-w-64 flex-1 basis-0 flex-col rounded-xl border border-t-4 border-border bg-white/60 transition-colors",
        meta.accent,
        isActiveTarget && "border-brand-olive bg-brand-mint/25",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-3">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className={cn("size-2.5 rounded-full", meta.dot)} aria-hidden="true" />
          {meta.label}
        </h2>
        <span
          className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", meta.badge)}
          title={truncated ? `Mostrando ${cards.length} de ${total}` : undefined}
        >
          {truncated ? `${cards.length} de ${countFormatter.format(total)}` : countFormatter.format(total)}
        </span>
      </header>

      <SortableContext id={status} items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
          {cards.map((card) => (
            <SortableOrderCard key={card.id} card={card} saving={savingIds.has(card.id)} />
          ))}
          {cards.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-xs text-ink-muted">
              Suelta un pedido aquí
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}
