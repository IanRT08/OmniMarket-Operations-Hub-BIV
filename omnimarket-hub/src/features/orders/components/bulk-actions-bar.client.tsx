"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { OrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_FLOW, statusLabel } from "@/lib/order-status";

type BulkActionsBarProps = {
  selectedCount: number;
  pending: boolean;
  onApply: (status: OrderStatus) => void;
  onClear: () => void;
};

/** Barra que aparece al seleccionar filas: aplica un estado a todas a la vez. */
export function BulkActionsBar({ selectedCount, pending, onApply, onClear }: BulkActionsBarProps) {
  const [status, setStatus] = useState<OrderStatus | "">("");

  return (
    <div
      role="region"
      aria-label="Acciones en lote"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-olive bg-brand-mint/40 px-4 py-3"
    >
      <p className="text-sm font-medium text-ink" aria-live="polite">
        {selectedCount} {selectedCount === 1 ? "pedido seleccionado" : "pedidos seleccionados"}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label htmlFor="bulk-status" className="text-sm text-ink">
          Cambiar estado a
        </label>
        <Select
          id="bulk-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "")}
          className="h-9 w-48"
        >
          <option value="">Elige un estado…</option>
          {ORDER_STATUS_FLOW.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
        <Button size="sm" className="h-9" disabled={!status || pending} onClick={() => status && onApply(status)}>
          {pending ? "Aplicando…" : "Aplicar"}
        </Button>
        <Button variant="ghost" size="sm" className="h-9" onClick={onClear} disabled={pending}>
          <X className="size-4" aria-hidden="true" />
          Quitar selección
        </Button>
      </div>
    </div>
  );
}
