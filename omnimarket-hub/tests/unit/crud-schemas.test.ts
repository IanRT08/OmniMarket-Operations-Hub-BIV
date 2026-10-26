import { describe, expect, it } from "vitest";
import { deleteOrderSchema, orderEditFormSchema, updateOrderSchema } from "@/features/orders/schemas";
import { deleteProductSchema, productEditFormSchema, updateProductSchema } from "@/features/products/schemas";

const ORDER_ID = "b0000000-0000-4000-8000-000000000001";
const PRODUCT_ID = "a0000000-0000-4000-8000-000000000001";

describe("edición de productos (formulario → updateProduct)", () => {
  const form = { name: "Audífonos Pulse 2", price: 1349.5, cost: 740, stockAdjustment: 0, isActive: true };

  it("convierte pesos a centavos y omite un ajuste de stock en 0", () => {
    const data = productEditFormSchema.parse(form);
    expect(data).toEqual({ name: "Audífonos Pulse 2", priceCents: 134_950, costCents: 74_000, isActive: true, stockAdjustment: undefined });
    // La salida del formulario + id es una entrada válida de la Server Action.
    expect(updateProductSchema.safeParse({ id: PRODUCT_ID, ...data }).success).toBe(true);
  });

  it("acepta mermas (ajuste negativo) y rechaza ajustes no enteros", () => {
    expect(productEditFormSchema.parse({ ...form, stockAdjustment: -5 }).stockAdjustment).toBe(-5);
    expect(productEditFormSchema.safeParse({ ...form, stockAdjustment: 1.5 }).success).toBe(false);
    expect(productEditFormSchema.safeParse({ ...form, stockAdjustment: Number.NaN }).success).toBe(false);
  });

  it("eliminar exige un UUID", () => {
    expect(deleteProductSchema.safeParse({ id: PRODUCT_ID }).success).toBe(true);
    expect(deleteProductSchema.safeParse({ id: "OM-AUD-001" }).success).toBe(false);
  });
});

describe("edición y eliminación de pedidos", () => {
  it("el formulario valida cliente y estado; la acción además exige id y versión", () => {
    const form = { customerName: "  Ana Rodríguez ", customerEmail: "ana@example.com", status: "SHIPPED" as const };
    expect(orderEditFormSchema.parse(form).customerName).toBe("Ana Rodríguez");
    expect(orderEditFormSchema.safeParse({ ...form, status: "LOST" }).success).toBe(false);
    expect(orderEditFormSchema.safeParse({ ...form, customerEmail: "ana" }).success).toBe(false);

    expect(updateOrderSchema.safeParse(form).success).toBe(false);
    expect(updateOrderSchema.safeParse({ ...form, orderId: ORDER_ID, version: 3 }).success).toBe(true);
  });

  it("eliminar exige la versión leída (concurrencia optimista)", () => {
    expect(deleteOrderSchema.safeParse({ orderId: ORDER_ID, version: 1 }).success).toBe(true);
    expect(deleteOrderSchema.safeParse({ orderId: ORDER_ID }).success).toBe(false);
    expect(deleteOrderSchema.safeParse({ orderId: ORDER_ID, version: 0 }).success).toBe(false);
  });
});
