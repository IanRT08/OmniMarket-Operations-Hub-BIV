"use client";

import { useMutationState, useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, RefreshCw, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/input";
import {
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { useBulkUpdate, type BulkUpdateVariables } from "@/features/orders/hooks/use-bulk-update";
import { ordersListQueryOptions } from "@/features/orders/queries";
import {
  orderListQueryToSearchParams,
  parseOrderListQuery,
  type OrderListQuery,
} from "@/features/orders/schemas";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, formatNumber } from "@/lib/format";
import { mutationKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { OrderListItem } from "@/server/dal/orders";
import { BulkActionsBar } from "./bulk-actions-bar.client";
import { OrdersFilters } from "./orders-filters.client";
import { OrderRowsSkeleton, OrdersTableSkeleton } from "./orders-table-skeleton";

// Estables a nivel de módulo (requisito de TanStack Table v9).
const features = tableFeatures({ rowSelectionFeature });
const column = createColumnHelper<typeof features, OrderListItem>();
const EMPTY_ROWS: OrderListItem[] = [];
const PAGE_SIZES = [10, 20, 50, 100];

const columns = column.columns([
  column.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Seleccionar todos los pedidos de la página"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Seleccionar ${row.original.orderNumber}`}
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  }),
  column.accessor("orderNumber", {
    header: "Pedido",
    cell: (info) => <span className="font-mono font-semibold">{info.getValue()}</span>,
  }),
  column.accessor("customerName", {
    header: "Cliente",
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="font-medium">{row.original.customerName}</p>
        <p className="text-xs text-ink-muted">{row.original.customerEmail}</p>
      </div>
    ),
  }),
  column.accessor("status", {
    header: "Estado",
    cell: (info) => <OrderStatusBadge status={info.getValue()} />,
  }),
  column.accessor("itemsCount", {
    header: "Artículos",
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  column.accessor("totalCents", {
    header: "Total",
    cell: (info) => <span className="font-semibold tabular-nums">{formatCurrency(info.getValue())}</span>,
  }),
  column.accessor("createdAt", {
    header: "Fecha",
    cell: (info) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(info.getValue())}</span>,
  }),
]);

const ALIGN_RIGHT = new Set(["itemsCount", "totalCents"]);

function searchParamsToRecord(params: URLSearchParams) {
  const record: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    record[key] = values.length > 1 ? values : values[0];
  }
  return record;
}

export function OrdersTable() {
  const searchParams = useSearchParams();
  const query = useMemo(() => parseOrderListQuery(searchParamsToRecord(searchParams)), [searchParams]);

  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery(ordersListQueryOptions(query));
  const bulkUpdate = useBulkUpdate();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Filas cuyo cambio en lote aún no confirma el servidor.
  const savingIds = new Set(
    useMutationState({
      filters: { mutationKey: mutationKeys.bulkUpdate, status: "pending" },
      select: (mutation) => (mutation.state.variables as BulkUpdateVariables | undefined)?.orderIds ?? [],
    }).flat(),
  );

  const table = useTable({
    features,
    columns,
    data: data?.rows ?? EMPTY_ROWS,
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  /**
   * Filtros y página viven en la URL (compartible, sobrevive a recargas).
   * history.pushState/replaceState se sincronizan con useSearchParams sin
   * volver a renderizar en el servidor: TanStack Query trae los datos.
   * Paginar crea entrada de historial (botón Atrás); filtrar la reemplaza.
   */
  function updateQuery(patch: Partial<OrderListQuery>) {
    const isPaging = "page" in patch || "pageSize" in patch;
    const next = { ...query, ...(isPaging ? {} : { page: 1 }), ...patch };
    const params = orderListQueryToSearchParams(next);
    const url = params.size > 0 ? `?${params}` : window.location.pathname;
    if ("page" in patch) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    setRowSelection({}); // la selección solo aplica a filas visibles
  }

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  function applyBulk(status: BulkUpdateVariables["status"]) {
    bulkUpdate.mutate({ orderIds: selectedIds, status }, { onSuccess: () => setRowSelection({}) });
  }

  if (isPending) return <OrdersTableSkeleton rows={Math.min(query.pageSize, 10)} />;

  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-white p-10 text-center">
        <TriangleAlert className="size-8 text-rose-600" aria-hidden="true" />
        <p className="font-medium text-ink">No se pudieron cargar los pedidos.</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="size-4" aria-hidden="true" /> Reintentar
        </Button>
      </div>
    );
  }

  const { pagination } = data;
  const firstRow = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastRow = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-col gap-4">
      <OrdersFilters query={query} onChange={updateQuery} />

      {selectedIds.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          pending={bulkUpdate.isPending}
          onApply={applyBulk}
          onClear={() => setRowSelection({})}
        />
      )}

      <TableContainer aria-busy={isPlaceholderData}>
        <Table data-testid="orders-table">
          <TableHead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <TableHeaderCell
                    key={header.id}
                    className={cn(header.column.id === "select" && "w-10", ALIGN_RIGHT.has(header.column.id) && "text-right")}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHeaderCell>
                ))}
              </tr>
            ))}
          </TableHead>
          <tbody>
            {isPlaceholderData ? (
              // Cambio de página o filtro: skeleton en lugar de las filas anteriores.
              <OrderRowsSkeleton rows={Math.min(data.rows.length || query.pageSize, 10)} />
            ) : data.rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-ink-muted">
                  No hay pedidos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-selected={row.getIsSelected()}
                  data-testid={`order-row-${row.original.orderNumber}`}
                  className={cn(savingIds.has(row.id) && "animate-pulse")}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className={cn(ALIGN_RIGHT.has(cell.column.id) && "text-right")}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </tbody>
        </Table>
      </TableContainer>

      <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <p aria-live="polite">
          {pagination.total === 0
            ? "Sin resultados"
            : `Mostrando ${formatNumber(firstRow)}–${formatNumber(lastRow)} de ${formatNumber(pagination.total)} pedidos`}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="orders-page-size">Por página</label>
          <Select
            id="orders-page-size"
            value={query.pageSize}
            onChange={(e) => updateQuery({ pageSize: Number(e.target.value), page: 1 })}
            className="h-8 w-20"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPreviousPage}
            onClick={() => updateQuery({ page: query.page - 1 })}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="tabular-nums">
            {pagination.totalPages === 0 ? 0 : pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasNextPage}
            onClick={() => updateQuery({ page: query.page + 1 })}
            aria-label="Página siguiente"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </nav>
    </div>
  );
}
