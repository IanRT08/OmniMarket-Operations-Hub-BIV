import { describe, expect, it } from "vitest";
import { orderListQuerySchema } from "@/features/orders/schemas";
import { createProductSchema, updateProductSchema } from "@/features/products/schemas";

describe("orderListQuerySchema", () => {
  it("aplica valores por defecto y acepta status repetido como arreglo", () => {
    expect(orderListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, status: [] });
    expect(orderListQuerySchema.parse({ status: "PENDING" }).status).toEqual(["PENDING"]);
    expect(orderListQuerySchema.parse({ page: "2", status: ["PENDING", "SHIPPED"] })).toMatchObject({
      page: 2,
      status: ["PENDING", "SHIPPED"],
    });
  });

  it("rechaza estados, fechas y rangos inválidos", () => {
    expect(orderListQuerySchema.safeParse({ status: "LOST" }).success).toBe(false);
    expect(orderListQuerySchema.safeParse({ from: "01/09/2026" }).success).toBe(false);
    expect(orderListQuerySchema.safeParse({ from: "2026-09-10", to: "2026-09-01" }).success).toBe(false);
  });
});

describe("esquemas de productos", () => {
  it("createProductSchema normaliza el SKU y rechaza montos inválidos", () => {
    const valid = { sku: " om-tst-001 ", name: "Producto de prueba", priceCents: 9_900, costCents: 5_000 };
    expect(createProductSchema.parse(valid)).toMatchObject({ sku: "OM-TST-001", stock: 0, isActive: true });
    expect(createProductSchema.safeParse({ ...valid, priceCents: -1 }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...valid, priceCents: 99.5 }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...valid, sku: "a!" }).success).toBe(false);
  });

  it("updateProductSchema exige al menos un cambio y un ajuste de stock distinto de 0", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    expect(updateProductSchema.safeParse({ id }).success).toBe(false);
    expect(updateProductSchema.safeParse({ id, stockAdjustment: 0 }).success).toBe(false);
    expect(updateProductSchema.safeParse({ id, stockAdjustment: -5 }).success).toBe(true);
    expect(updateProductSchema.safeParse({ id, isActive: false }).success).toBe(true);
  });
});
