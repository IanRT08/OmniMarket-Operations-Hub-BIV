"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog.client";
import { useDeleteOrder } from "@/features/orders/hooks/use-delete-order";
import { OrderStatus } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/currency";
import type { OrderListItem } from "@/server/dal/orders";

/** Editar y eliminar un pedido desde su fila de la tabla. */
export function OrderRowActions({ order }: { order: OrderListItem }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteOrder();

  return (
    <div className="flex justify-end gap-1">
      <Link
        href={`/orders/${order.id}/edit`}
        className={buttonClasses({ variant: "ghost", size: "sm" })}
        aria-label={`Editar ${order.orderNumber}`}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Link>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Eliminar ${order.orderNumber}`}>
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`¿Eliminar ${order.orderNumber}?`}
        description={
          <>
            Se borrará el pedido de <strong className="text-ink">{order.customerName}</strong> (
            {formatCurrency(order.totalCents)}) con sus partidas y su historial.
            {order.status !== OrderStatus.CANCELLED && " Su stock regresa al inventario y deja de contar en las métricas."}{" "}
            Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar pedido"
        onConfirm={() => {
          // Optimista: el diálogo se cierra y la fila desaparece de inmediato.
          setConfirming(false);
          remove.mutate({ orderId: order.id, version: order.version, orderNumber: order.orderNumber });
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
