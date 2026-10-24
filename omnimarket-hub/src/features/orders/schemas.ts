import "@/lib/zod-locale";
import { z } from "zod";
import { OrderStatus } from "@/generated/prisma/enums";

// Esquemas compartidos por el formulario (React Hook Form), las Server
// Actions y los tests unitarios.

export const ORDER_MAX_ITEMS = 20;
export const BULK_UPDATE_MAX_IDS = 100;

export const orderItemSchema = z.object({
  productId: z.uuid("Elige un producto"),
  quantity: z
    .number("Escribe una cantidad")
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad debe ser mayor a 0")
    .max(999, "Máximo 999 piezas por producto"),
});

export const createOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Escribe el nombre del cliente")
    .max(120, "Máximo 120 caracteres"),
  customerEmail: z.email("Escribe un email válido").max(254),
  items: z
    .array(orderItemSchema)
    .min(1, "Agrega al menos un producto")
    .max(ORDER_MAX_ITEMS, `Máximo ${ORDER_MAX_ITEMS} productos por pedido`)
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, {
      message: "Cada producto solo puede aparecer una vez; ajusta la cantidad",
    }),
});

export const cancelOrderSchema = z.object({
  orderId: z.uuid(),
  /** Versión que el cliente vio; si cambió, la cancelación se rechaza por conflicto. */
  version: z.number().int().min(1),
});

export const bulkUpdateSchema = z.object({
  orderIds: z.array(z.uuid()).min(1).max(BULK_UPDATE_MAX_IDS),
  status: z.enum(OrderStatus),
});

const businessDaySchema = z.iso.date(); // YYYY-MM-DD, día de negocio en CDMX

// Searchparams de la tabla de pedidos (/orders?page=2&status=PENDING&status=SHIPPED&from=…).
// Acepta lo que entrega Next en `searchParams`: string, string[] o undefined.
export const orderListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .preprocess((value) => (value === undefined ? [] : [value].flat()), z.array(z.enum(OrderStatus)))
      .default([]),
    from: businessDaySchema.optional(),
    to: businessDaySchema.optional(),
    /** Número de pedido, nombre o email del cliente (contiene, sin distinguir mayúsculas). */
    q: z.string().trim().max(100).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "La fecha inicial debe ser anterior o igual a la final",
    path: ["to"],
  });

export type OrderListQuery = z.output<typeof orderListQuerySchema>;

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Convierte searchParams crudos en una consulta canónica. El RSC (prefetch)
 * y el cliente (useQuery) la usan para construir la MISMA llave de cache:
 * - quita valores vacíos ("?q=" no es un filtro),
 * - descarta solo los parámetros inválidos en lugar de toda la URL,
 * - deduplica y ordena los estados para que ?status=A&status=B y
 *   ?status=B&status=A sean la misma entrada de cache.
 */
export function parseOrderListQuery(raw: RawSearchParams): OrderListQuery {
  const cleaned: RawSearchParams = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)),
  );

  let result = orderListQuerySchema.safeParse(cleaned);
  if (!result.success) {
    const invalidKeys = new Set(result.error.issues.map((issue) => String(issue.path[0])));
    result = orderListQuerySchema.safeParse(
      Object.fromEntries(Object.entries(cleaned).filter(([key]) => !invalidKeys.has(key))),
    );
  }
  const query = result.success ? result.data : orderListQuerySchema.parse({});

  const statusOrder = Object.values(OrderStatus);
  return {
    ...query,
    q: query.q || undefined,
    status: [...new Set(query.status)].sort((a, b) => statusOrder.indexOf(a) - statusOrder.indexOf(b)),
  };
}

/** Inverso de parseOrderListQuery: omite los valores por defecto para URLs limpias. */
export function orderListQueryToSearchParams(query: OrderListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  query.status.forEach((status) => params.append("status", status));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.q) params.set("q", query.q);
  return params;
}

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderData = z.output<typeof createOrderSchema>;
export type CancelOrderInput = z.input<typeof cancelOrderSchema>;
export type BulkUpdateInput = z.input<typeof bulkUpdateSchema>;
export type BulkUpdateData = z.output<typeof bulkUpdateSchema>;
