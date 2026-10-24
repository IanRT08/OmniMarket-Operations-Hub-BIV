import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { CreateProductData, ProductListQuery, UpdateProductData } from "@/features/products/schemas";
import { db } from "@/server/db";
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

// ============================================================================
// Catálogo
// ============================================================================

const productSelect = {
  id: true,
  sku: true,
  name: true,
  priceCents: true,
  costCents: true,
  stock: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

export type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

// El catálogo es acotado (decenas o cientos de SKUs): se devuelve completo,
// con un tope de seguridad, y la tabla pagina/ordena en el cliente.
const PRODUCT_LIST_CAP = 500;

/** Listado de la página de productos. Por defecto solo activos. */
export async function listProducts({ q, includeInactive }: ProductListQuery): Promise<ProductRow[]> {
  return db.product.findMany({
    where: {
      ...(!includeInactive && { isActive: true }),
      ...(q && {
        OR: [
          { sku: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: PRODUCT_LIST_CAP,
    select: productSelect,
  });
}

/**
 * Opciones del selector de productos al crear un pedido: solo activos. Se
 * incluyen los agotados (stock 0) para que la UI los muestre deshabilitados;
 * el servidor valida el stock de todas formas al crear el pedido.
 */
export async function getProductOptions() {
  return db.product.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: PRODUCT_LIST_CAP,
    select: { id: true, sku: true, name: true, priceCents: true, stock: true },
  });
}

export type ProductOption = Awaited<ReturnType<typeof getProductOptions>>[number];

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createProduct(input: CreateProductData): Promise<ProductRow> {
  const skuTaken = () =>
    new DomainError("SKU_TAKEN", `Ya existe un producto con el SKU ${input.sku}`, { sku: input.sku });

  // Chequeo previo para el caso común: así un SKU repetido no deja un
  // "prisma:error" en los logs. El catch cubre la carrera entre dos altas.
  if (await db.product.findUnique({ where: { sku: input.sku }, select: { id: true } })) throw skuTaken();

  try {
    return await db.product.create({ data: input, select: productSelect });
  } catch (error) {
    if (isUniqueViolation(error)) throw skuTaken();
    throw error;
  }
}

/**
 * Edita datos del producto y/o ajusta su stock en un solo UPDATE atómico.
 * El ajuste es relativo (stock = stock + n): no pisa los descuentos que hagan
 * pedidos simultáneos. Un ajuste negativo solo aplica si hay stock
 * suficiente (WHERE stock >= −n); si no, INSUFFICIENT_STOCK.
 * Cambiar precio o costo no altera pedidos existentes: guardan su snapshot.
 */
export async function updateProduct({ id, stockAdjustment, ...changes }: UpdateProductData): Promise<ProductRow> {
  const decrement = stockAdjustment !== undefined && stockAdjustment < 0 ? -stockAdjustment : 0;

  const [product] = await db.product.updateManyAndReturn({
    where: { id, ...(decrement > 0 && { stock: { gte: decrement } }) },
    data: { ...changes, ...(stockAdjustment !== undefined && { stock: { increment: stockAdjustment } }) },
    select: productSelect,
  });
  if (product) return product;

  const current = await db.product.findUnique({ where: { id }, select: { sku: true, stock: true } });
  if (!current) throw new DomainError("PRODUCT_NOT_FOUND", "El producto no existe", { id });
  throw new DomainError(
    "INSUFFICIENT_STOCK",
    `Stock insuficiente: ${current.sku} tiene ${current.stock}, no se pueden retirar ${decrement}`,
    { shortfalls: [{ productId: id, sku: current.sku, stock: current.stock, requested: decrement }] },
  );
}
