import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import { filterOrders } from "@/lib/filters";

const orders: { id: string; status: OrderStatus; createdAt: Date | string }[] = [
  { id: "1", status: "PENDING", createdAt: new Date("2026-09-01T15:00:00Z") }, // 1 sep 09:00 CDMX
  { id: "2", status: "SHIPPED", createdAt: new Date("2026-09-02T03:30:00Z") }, // 1 sep 21:30 CDMX
  { id: "3", status: "PENDING", createdAt: "2026-09-02T18:00:00Z" }, //          2 sep 12:00 CDMX
  { id: "4", status: "CANCELLED", createdAt: "2026-09-03T16:00:00Z" }, //        3 sep 10:00 CDMX
  { id: "5", status: "PENDING", createdAt: "2026-09-04T06:30:00Z" }, //          4 sep 00:30 CDMX
];

describe("filterOrders", () => {
  it("filtra por estado y rango de fechas (día de CDMX, inclusivo)", () => {
    const ids = (filters: Parameters<typeof filterOrders>[1]) =>
      filterOrders(orders, filters).map((order) => order.id);

    expect(ids({})).toEqual(["1", "2", "3", "4", "5"]);
    expect(ids({ statuses: ["PENDING"] })).toEqual(["1", "3", "5"]);
    // El pedido 2 es del 2 sep en UTC pero del 1 sep en CDMX.
    expect(ids({ from: "2026-09-01", to: "2026-09-01" })).toEqual(["1", "2"]);
    expect(ids({ statuses: ["PENDING", "CANCELLED"], from: "2026-09-02", to: "2026-09-03" })).toEqual(["3", "4"]);
    expect(ids({ statuses: ["PENDING"], from: "2026-09-04" })).toEqual(["5"]);
  });
});
