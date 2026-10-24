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

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderData = z.output<typeof createOrderSchema>;
export type CancelOrderInput = z.input<typeof cancelOrderSchema>;
export type BulkUpdateInput = z.input<typeof bulkUpdateSchema>;
