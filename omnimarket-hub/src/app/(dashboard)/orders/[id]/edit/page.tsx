import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Table, TableCell, TableContainer, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { OrderEditForm } from "@/features/orders/components/order-edit-form.client";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getOrderDetail } from "@/server/dal/orders";

export const metadata: Metadata = { title: "Editar pedido" };

export default async function EditOrderPage({ params }: PageProps<"/orders/[id]/edit">) {
  const { id } = await params;
  // Un id que no es UUID haría fallar la consulta (columna uuid): es un 404.
  const order = z.uuid().safeParse(id).success ? await getOrderDetail(id) : null;
  if (!order) notFound();

  return (
    <>
      <PageHeader
        title={`Editar ${order.orderNumber}`}
        description={`Creado el ${formatDateTime(order.createdAt)}. Cambia los datos del cliente o el estado del pedido.`}
        action={<OrderStatusBadge status={order.status} className="text-sm" />}
      />

      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_22rem]">
        {/* key: tras un VERSION_CONFLICT, router.refresh() trae otra versión y remonta el formulario. */}
        <OrderEditForm key={order.version} order={order} />

        <section aria-labelledby="order-items-title" className="flex flex-col gap-3">
          <h2 id="order-items-title" className="text-base font-semibold text-ink">
            Partidas
          </h2>
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Producto</TableHeaderCell>
                  <TableHeaderCell className="text-right">Cant.</TableHeaderCell>
                  <TableHeaderCell className="text-right">Subtotal</TableHeaderCell>
                </tr>
              </TableHead>
              <tbody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="font-mono text-xs text-ink-muted">
                        {item.product.sku} · {formatCurrency(item.unitPriceCents)} c/u
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(item.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(item.quantity * item.unitPriceCents)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-medium text-ink-muted">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-brand-moss">
                    {formatCurrency(order.totalCents)}
                  </TableCell>
                </TableRow>
              </tbody>
            </Table>
          </TableContainer>
          <p className="text-xs text-ink-muted">
            Las partidas guardan el precio de la venta y no se editan: para cambiarlas, cancela el pedido y crea uno
            nuevo.
          </p>
        </section>
      </div>
    </>
  );
}
