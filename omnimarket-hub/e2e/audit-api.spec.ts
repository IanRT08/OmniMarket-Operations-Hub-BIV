import { expect, test } from "@playwright/test";
import { E2E_ORDER_ID, E2E_ORDER_NUMBER } from "./fixtures/seed-ids";

// Contrato de los endpoints de auditoría contra el dataset recién sembrado
// por auth.setup.ts. Los flujos de UI (auth, create-order, kanban-dnd) se
// agregan junto con el frontend.

const SLA_MS = 300;

test.describe("GET /api/test/analytics", () => {
  test("pagina las métricas pre-agregadas dentro del SLA", async ({ request }) => {
    const response = await request.get("/api/test/analytics?page=1&limit=10");
    expect(response.status()).toBe(200);
    expect(response.headers()["server-timing"]).toContain("total;dur=");

    const body = await response.json();
    expect(body.data).toHaveLength(10);
    expect(body.pagination).toMatchObject({ page: 1, limit: 10, total: 35, totalPages: 4, hasNextPage: true });
    expect(body.summary.ordersByStatus).toEqual({
      PENDING: 21,
      PROCESSING: 21,
      SHIPPED: 21,
      DELIVERED: 32,
      CANCELLED: 10,
    });
    expect(body.meta.durationMs).toBeLessThan(SLA_MS);
  });

  test("responde 400 con limit > 100", async ({ request }) => {
    const response = await request.get("/api/test/analytics?limit=101");
    expect(response.status()).toBe(400);
    expect((await response.json()).error.details).toHaveProperty("limit");
  });
});

test.describe("GET /api/test/kanban-status", () => {
  test("devuelve el último evento del pedido E2E", async ({ request }) => {
    for (const orderId of [E2E_ORDER_NUMBER, E2E_ORDER_ID]) {
      const response = await request.get(`/api/test/kanban-status?orderId=${orderId}`);
      expect(response.status()).toBe(200);

      const { data } = await response.json();
      expect(data.order).toMatchObject({ id: E2E_ORDER_ID, status: "PENDING", position: "a0" });
      expect(data.lastEvent).toMatchObject({ fromStatus: null, toStatus: "PENDING" });
    }
  });

  test("responde 404 si el pedido no existe", async ({ request }) => {
    const response = await request.get("/api/test/kanban-status?orderId=OM-NO-EXISTE");
    expect(response.status()).toBe(404);
  });
});

test.describe("POST /api/test/reset-data", () => {
  test("rechaza peticiones sin x-audit-token", async ({ request }) => {
    const response = await request.post("/api/test/reset-data");
    expect(response.status()).toBe(401);
  });
});
