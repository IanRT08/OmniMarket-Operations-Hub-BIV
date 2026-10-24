import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/server/errors";

// ============================================================================
// Inventario. El stock se descuenta cuando un pedido cuenta como venta (al
// crearse o al salir de CANCELLED) y se repone cuando entra a CANCELLED; es
// la misma regla que siguen las métricas diarias. Ambas funciones operan
// sobre varios pedidos a la vez (Bulk Update) y suman las cantidades por
// producto antes de tocar cada fila.
//
// Bloqueo: primero se toman los locks de los productos en orden de id. Así
// dos transacciones que comparten productos siempre los piden en el mismo
// orden y no pueden bloquearse mutuamente (deadlock), y la verificación de
// stock y el UPDATE ven el mismo valor.
// ============================================================================

async function lockProductsOfOrders(tx: Prisma.TransactionClient, orderIds: string[]) {
  await tx.$queryRaw`
    SELECT p."id"
    FROM "products" p
    WHERE p."id" IN (
      SELECT DISTINCT "product_id" FROM "order_items" WHERE "order_id" = ANY(${orderIds}::uuid[])
    )
    ORDER BY p."id"
    FOR UPDATE
  `;
}

type StockShortfall = { productId: string; sku: string; name: string; stock: number; requested: number };

/**
 * Descuenta del stock las partidas de `orderIds`. Si algún producto no
 * alcanza, lanza INSUFFICIENT_STOCK con el detalle y la transacción completa
 * se revierte (incluido el pedido recién creado).
 */
export async function reserveStockForOrders(tx: Prisma.TransactionClient, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  await lockProductsOfOrders(tx, orderIds);

  const shortfalls = await tx.$queryRaw<StockShortfall[]>`
    SELECT p."id" AS "productId", p."sku", p."name", p."stock", r."requested"
    FROM "products" p
    JOIN (
      SELECT "product_id", SUM("quantity")::int AS "requested"
      FROM "order_items"
      WHERE "order_id" = ANY(${orderIds}::uuid[])
      GROUP BY "product_id"
    ) r ON r."product_id" = p."id"
    WHERE p."stock" < r."requested"
    ORDER BY p."sku"
  `;

  if (shortfalls.length > 0) {
    throw new DomainError(
      "INSUFFICIENT_STOCK",
      `Stock insuficiente: ${shortfalls.map((s) => `${s.sku} (hay ${s.stock}, se piden ${s.requested})`).join(", ")}`,
      { shortfalls },
    );
  }

  await tx.$executeRaw`
    UPDATE "products" AS p SET
      "stock" = p."stock" - r."requested",
      "updated_at" = now()
    FROM (
      SELECT "product_id", SUM("quantity")::int AS "requested"
      FROM "order_items"
      WHERE "order_id" = ANY(${orderIds}::uuid[])
      GROUP BY "product_id"
    ) r
    WHERE p."id" = r."product_id"
  `;
}

/** Repone al stock las partidas de `orderIds` (cancelación). */
export async function releaseStockForOrders(tx: Prisma.TransactionClient, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  await lockProductsOfOrders(tx, orderIds);

  await tx.$executeRaw`
    UPDATE "products" AS p SET
      "stock" = p."stock" + r."released",
      "updated_at" = now()
    FROM (
      SELECT "product_id", SUM("quantity")::int AS "released"
      FROM "order_items"
      WHERE "order_id" = ANY(${orderIds}::uuid[])
      GROUP BY "product_id"
    ) r
    WHERE p."id" = r."product_id"
  `;
}
