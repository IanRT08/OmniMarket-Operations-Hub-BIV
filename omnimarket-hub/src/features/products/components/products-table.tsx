import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableContainer, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { grossMarginRatio } from "@/lib/finance";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductRow } from "@/server/dal/products";
import { ProductRowActions } from "./product-row-actions.client";

const LOW_STOCK = 10;

function StockBadge({ stock }: { stock: number }) {
  const tone =
    stock === 0
      ? "bg-rose-100 text-rose-900"
      : stock < LOW_STOCK
        ? "bg-amber-100 text-amber-900"
        : "bg-brand-mint/50 text-ink";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums", tone)}>
      {stock === 0 ? "Agotado" : formatNumber(stock)}
    </span>
  );
}

/** Catálogo (Server Component); solo las acciones de cada fila son de cliente. */
export function ProductsTable({ products }: { products: ProductRow[] }) {
  return (
    <TableContainer>
      <Table data-testid="products-table">
        <TableHead>
          <tr>
            <TableHeaderCell>SKU</TableHeaderCell>
            <TableHeaderCell>Producto</TableHeaderCell>
            <TableHeaderCell className="text-right">Precio</TableHeaderCell>
            <TableHeaderCell className="text-right">Costo</TableHeaderCell>
            <TableHeaderCell className="text-right">Margen</TableHeaderCell>
            <TableHeaderCell className="text-right">Stock</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell className="text-right">
              <span className="sr-only">Acciones</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-sm text-ink-muted">
                No hay productos que coincidan con la búsqueda.
              </td>
            </tr>
          ) : (
            products.map((product) => {
              const margin = grossMarginRatio(product.priceCents, product.costCents);
              return (
                <TableRow key={product.id} data-testid={`product-row-${product.sku}`}>
                  <TableCell className="font-mono font-semibold">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(product.priceCents)}</TableCell>
                  <TableCell className="text-right text-ink-muted tabular-nums">{formatCurrency(product.costCents)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", margin < 0 && "font-medium text-rose-700")}>
                    {formatPercent(margin)}
                  </TableCell>
                  <TableCell className="text-right">
                    <StockBadge stock={product.stock} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        product.isActive ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      {product.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell className="py-1">
                    <ProductRowActions product={product} />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </tbody>
      </Table>
    </TableContainer>
  );
}

/** Skeleton con la misma estructura (loading.tsx de /products). */
export function ProductsTableSkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <TableContainer role="status" aria-label="Cargando productos">
      <div className="h-11 bg-brand-mint/30" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-4 last:border-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
      <span className="sr-only">Cargando productos…</span>
    </TableContainer>
  );
}
