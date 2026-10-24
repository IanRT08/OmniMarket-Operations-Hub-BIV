import { z } from "zod";
import { OrderStatus } from "@/generated/prisma/enums";

// Esquemas compartidos por el formulario (React Hook Form), las Server
// Actions y los tests unitarios.

export const ORDER_MAX_ITEMS = 20;
export const BULK_UPDATE_MAX_IDS = 100;

export const orderItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(999),
});

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.email().max(254),
  items: z
    .array(orderItemSchema)
    .min(1)
    .max(ORDER_MAX_ITEMS)
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

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderData = z.output<typeof createOrderSchema>;
export type CancelOrderInput = z.input<typeof cancelOrderSchema>;
export type BulkUpdateInput = z.input<typeof bulkUpdateSchema>;
export type BulkUpdateData = z.output<typeof bulkUpdateSchema>;
