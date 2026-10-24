"use client";

import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { OrderListQuery } from "@/features/orders/schemas";
import type { OrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_FLOW, ORDER_STATUS_META } from "@/lib/order-status";
import { cn } from "@/lib/utils";

type OrdersFiltersProps = {
  query: OrderListQuery;
  onChange: (patch: Partial<OrderListQuery>) => void;
};

const SEARCH_DEBOUNCE_MS = 300;

export function OrdersFilters({ query, onChange }: OrdersFiltersProps) {
  const [search, setSearch] = useState(query.q ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce en el handler (no en un efecto): una consulta por pausa al teclear.
  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => onChange({ q: value.trim() || undefined }), SEARCH_DEBOUNCE_MS);
  }

  function toggleStatus(status: OrderStatus) {
    const next = query.status.includes(status)
      ? query.status.filter((s) => s !== status)
      : [...query.status, status];
    onChange({ status: next });
  }

  const hasFilters = Boolean(query.q || query.from || query.to || query.status.length);

  function clearAll() {
    clearTimeout(debounce.current);
    setSearch("");
    onChange({ q: undefined, from: undefined, to: undefined, status: [] });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          <Label htmlFor="orders-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <Input
              id="orders-search"
              type="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Número, cliente o email"
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="orders-from">Desde</Label>
          <Input
            id="orders-from"
            type="date"
            value={query.from ?? ""}
            max={query.to}
            onChange={(e) => onChange({ from: e.target.value || undefined })}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="orders-to">Hasta</Label>
          <Input
            id="orders-to"
            type="date"
            value={query.to ?? ""}
            min={query.from}
            onChange={(e) => onChange({ to: e.target.value || undefined })}
            className="w-40"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clearAll}>
            <X className="size-4" aria-hidden="true" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {ORDER_STATUS_FLOW.map((status) => {
          const active = query.status.includes(status);
          const meta = ORDER_STATUS_META[status];
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
                active ? "border-brand-moss bg-brand-moss text-white" : "border-border bg-white text-ink hover:border-brand-olive",
              )}
            >
              <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
