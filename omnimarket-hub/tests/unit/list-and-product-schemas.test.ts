import { describe, expect, it } from "vitest";
import {
  orderListQuerySchema,
  orderListQueryToSearchParams,
  parseOrderListQuery,
} from "@/features/orders/schemas";
import { createProductSchema, productFormSchema, updateProductSchema } from "@/features/products/schemas";
import { pesosToCents } from "@/lib/currency";

describe("parseOrderListQuery (llave de cache compartida servidor/cliente)", () => {
  it("normaliza: vacíos fuera, estados deduplicados y en orden del flujo", () => {
    const query = parseOrderListQuery({ q: "", status: ["SHIPPED", "PENDING", "SHIPPED"], page: "2" });
    expect(query).toEqual({ page: 2, pageSize: 20, status: ["PENDING", "SHIPPED"], q: undefined });
    // El orden de los parámetros en la URL no cambia la consulta.
    expect(parseOrderListQuery({ status: ["PENDING", "SHIPPED"] })).toEqual(parseOrderListQuery({ status: ["SHIPPED", "PENDING"] }));
  });

  it("descarta solo los parámetros inválidos y conserva el resto", () => {
    const query = parseOrderListQuery({ page: "-3", status: "PENDING", from: "2026-09-10", to: "2026-09-01" });
    expect(query).toMatchObject({ page: 1, status: ["PENDING"], from: "2026-09-10" });
    expect(query.to).toBeUndefined();
  });

  it("ida y vuelta con la URL omitiendo valores por defecto", () => {
    const query = parseOrderListQuery({ page: "3", status: ["PENDING"], q: "lópez" });
    const params = orderListQueryToSearchParams(query);
    expect(params.toString()).toBe("page=3&status=PENDING&q=l%C3%B3pez");
    expect(orderListQueryToSearchParams(parseOrderListQuery({})).toString()).toBe("");
  });
});

describe("formulario de productos (pesos → centavos)", () => {
  it("convierte pesos a centavos sin errores de punto flotante", () => {
    expect(pesosToCents(12.5)).toBe(1250);
    expect(pesosToCents(0.1 + 0.2)).toBe(30);
    expect(pesosToCents(1299.99)).toBe(129_999);
  });

  it("transforma el formulario a la entrada de la Server Action y rechaza más de 2 decimales", () => {
    const form = { sku: "om-new-001", name: "Producto", price: 1299.9, cost: 800, stock: 5, isActive: true };
    expect(productFormSchema.parse(form)).toEqual({
      sku: "OM-NEW-001",
      name: "Producto",
      priceCents: 129_990,
      costCents: 80_000,
      stock: 5,
      isActive: true,
    });
    expect(productFormSchema.safeParse({ ...form, price: 10.999 }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...form, price: Number.NaN }).success).toBe(false);
  });
});

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
