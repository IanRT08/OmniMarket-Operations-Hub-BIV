import { LoaderCircle, Package } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { BUSINESS_TIMEZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { KanbanCard } from "@/server/dal/orders";

const createdAtFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: BUSINESS_TIMEZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type OrderCardProps = {
  card: KanbanCard;
  /** Vista que sigue al puntero (DragOverlay). */
  overlay?: boolean;
  /** Hueco que deja la tarjeta en su lugar mientras se arrastra. */
  placeholder?: boolean;
  /** El servidor aún no confirma el último movimiento de esta tarjeta. */
  saving?: boolean;
};

/** Tarjeta de pedido (solo presentación; el arrastre lo agrega SortableOrderCard). */
export function OrderCard({ card, overlay, placeholder, saving }: OrderCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-white p-3 shadow-sm transition-shadow",
        "hover:border-brand-olive hover:shadow",
        overlay && "rotate-1 cursor-grabbing border-brand-olive shadow-lg ring-2 ring-brand-lime/60",
        placeholder && "border-dashed border-brand-olive bg-brand-mint/20 shadow-none [&>*]:invisible",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-ink">{card.orderNumber}</span>
        <span className="text-sm font-semibold tabular-nums text-brand-moss">{formatCurrency(card.totalCents)}</span>
      </div>

      <p className="mt-1 truncate text-sm text-ink-muted" title={card.customerName}>
        {card.customerName}
      </p>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <Package className="size-3.5" aria-hidden="true" />
          {card.itemsCount} {card.itemsCount === 1 ? "artículo" : "artículos"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {saving && <LoaderCircle className="size-3.5 animate-spin text-brand-moss" aria-label="Guardando" />}
          <time dateTime={new Date(card.createdAt).toISOString()}>
            {createdAtFormatter.format(new Date(card.createdAt))}
          </time>
        </span>
      </div>
    </div>
  );
}
