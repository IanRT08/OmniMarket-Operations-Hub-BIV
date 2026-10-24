"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCurrency } from "@/lib/currency";
import type { KanbanCard } from "@/server/dal/orders";
import { OrderCard } from "./order-card";

type SortableOrderCardProps = { card: KanbanCard; saving: boolean };

/**
 * Tarjeta arrastrable. Toda la tarjeta es el "handle" (PointerSensor con
 * distancia mínima, así un clic no inicia el arrastre) y es enfocable para el
 * KeyboardSensor: Espacio/Enter la toma, flechas la mueven, Espacio la suelta.
 */
export function SortableOrderCard({ card, saving }: SortableOrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", status: card.status },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="cursor-grab touch-none rounded-lg active:cursor-grabbing"
      data-testid={`order-card-${card.orderNumber}`}
      data-status={card.status}
      aria-label={`Pedido ${card.orderNumber} de ${card.customerName}, ${formatCurrency(card.totalCents)}`}
      {...attributes}
      {...listeners}
    >
      <OrderCard card={card} placeholder={isDragging} saving={saving} />
    </li>
  );
}
