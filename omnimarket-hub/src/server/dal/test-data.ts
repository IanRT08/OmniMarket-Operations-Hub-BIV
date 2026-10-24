import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { rebuildDailySalesMetrics } from "@/server/dal/analytics";
import { db } from "@/server/db";
import { buildSeedDataset } from "@/server/seed/dataset";

export const E2E_USER_ID = "e2e-user";
const E2E_SESSION_ID = "e2e-session";
const E2E_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Vacía las tablas de negocio y carga el dataset estático. Lo usan
 * POST /api/test/reset-data y `npx prisma db seed`.
 *
 * - Una sola transacción: TRUNCATE es transaccional en Postgres, así que o
 *   queda el seed completo o la BD queda exactamente como estaba.
 * - Advisory lock de transacción: dos resets simultáneos (CI + evaluador) se
 *   serializan en vez de intercalar TRUNCATE e INSERT.
 * - Un solo TRUNCATE con todas las tablas: Postgres valida las FKs contra el
 *   conjunto completo, así que el orden no importa. Sin CASCADE a propósito:
 *   si alguien agrega una tabla que apunte a estas y no la incluye aquí, el
 *   reset falla en vez de vaciarla en silencio.
 * - Las tablas de Better Auth no se tocan: borrarlas cerraría la sesión OAuth
 *   real del evaluador. Solo se crea/renueva la sesión E2E si existe
 *   E2E_SESSION_TOKEN (no definirla en producción).
 */
export async function resetTestData() {
  const dataset = buildSeedDataset();

  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('omnimarket:reset-data'))`;

      await tx.$executeRaw`
        TRUNCATE TABLE
          "order_status_events",
          "order_items",
          "orders",
          "products",
          "daily_sales_metrics"
        RESTART IDENTITY
      `;

      const products = await tx.product.createMany({ data: dataset.products });
      const orders = await tx.order.createMany({ data: dataset.orders });
      const orderItems = await tx.orderItem.createMany({ data: dataset.orderItems });
      const statusEvents = await tx.orderStatusEvent.createMany({ data: dataset.statusEvents });
      const dailyMetrics = await rebuildDailySalesMetrics(tx);
      const e2eSession = await upsertE2eSession(tx);

      return {
        products: products.count,
        orders: orders.count,
        orderItems: orderItems.count,
        statusEvents: statusEvents.count,
        dailyMetrics,
        e2eSession,
      };
    },
    // Margen para BDs remotas con cold start (Neon suspende por inactividad).
    { maxWait: 10_000, timeout: 30_000 },
  );
}

export type ResetSummary = Awaited<ReturnType<typeof resetTestData>>;

async function upsertE2eSession(tx: Prisma.TransactionClient): Promise<boolean> {
  const token = process.env.E2E_SESSION_TOKEN;
  if (!token) return false;

  await tx.user.upsert({
    where: { id: E2E_USER_ID },
    create: { id: E2E_USER_ID, name: "Auditor E2E", email: "e2e@omnimarket.test", emailVerified: true },
    update: {},
  });

  const expiresAt = new Date(Date.now() + E2E_SESSION_TTL_MS);
  await tx.session.upsert({
    where: { id: E2E_SESSION_ID },
    create: { id: E2E_SESSION_ID, token, userId: E2E_USER_ID, expiresAt },
    update: { token, userId: E2E_USER_ID, expiresAt },
  });

  return true;
}
