import { describe, expect, it } from "vitest";
import { bulkUpdateSchema, createOrderSchema } from "@/features/orders/schemas";

const PRODUCT_A = "a0000000-0000-4000-8000-000000000001";
const PRODUCT_B = "a0000000-0000-4000-8000-000000000002";
const orderId = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const validOrder = {
  customerName: "María López",
  customerEmail: "maria.lopez@example.com",
  items: [
    { productId: PRODUCT_A, quantity: 2 },
    { productId: PRODUCT_B, quantity: 1 },
  ],
};

describe("createOrderSchema", () => {
  it("acepta una entrada válida", () => {
    const result = createOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rechaza cantidad ≤ 0", () => {
    for (const quantity of [0, -1]) {
      const result = createOrderSchema.safeParse({
        ...validOrder,
        items: [{ productId: PRODUCT_A, quantity }],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["items", 0, "quantity"]);
    }
  });
});

describe("bulkUpdateSchema", () => {
  it("rechaza más de 100 IDs o un estado inválido", () => {
    const hundredIds = Array.from({ length: 100 }, (_, i) => orderId(i + 1));
    expect(bulkUpdateSchema.safeParse({ orderIds: hundredIds, status: "SHIPPED" }).success).toBe(true);

    const tooMany = bulkUpdateSchema.safeParse({ orderIds: [...hundredIds, orderId(101)], status: "SHIPPED" });
    expect(tooMany.success).toBe(false);
    expect(tooMany.error?.issues[0]?.path).toEqual(["orderIds"]);

    const badStatus = bulkUpdateSchema.safeParse({ orderIds: [orderId(1)], status: "LOST" });
    expect(badStatus.success).toBe(false);
    expect(badStatus.error?.issues[0]?.path).toEqual(["status"]);
  });
});
