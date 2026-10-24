import { generateNKeysBetween } from "fractional-indexing";
import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";

// ============================================================================
// Dataset estático de prueba: 12 productos, 105 pedidos, 228 partidas.
// ----------------------------------------------------------------------------
// Determinista: sin Math.random() ni Date.now(). IDs, fechas, estados y
// posiciones salen de fórmulas fijas sobre el índice, así cada reset produce
// exactamente las mismas filas y las pruebas E2E pueden fijar sus IDs.
//
// Este módulo es datos puros (sin "server-only" ni acceso a BD) para que
// e2e/fixtures/seed-ids.ts pueda importar las constantes de abajo.
// ============================================================================

/** Pedido que la prueba de Drag & Drop arrastra: primera tarjeta de PENDING. */
export const E2E_ORDER_NUMBER = "OM-E2E-0001";
export const E2E_ORDER_ID = "b0000000-0000-4000-8000-000000000001";

export const SEED_COUNTS = { products: 12, orders: 105, orderItems: 228 } as const;

const seedUuid = (prefix: "a" | "b" | "c", n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// 1 sep 2026, 00:00 en CDMX (UTC−6 todo el año desde 2022).
const FIRST_BUSINESS_DAY = Date.UTC(2026, 8, 1, 6);
// 3 pedidos por día de negocio. 21:30 CDMX ya es el día siguiente en UTC:
// así el dataset ejercita la agrupación por zona horaria de las métricas.
const DAILY_SLOTS = [9 * HOUR + 15 * 60_000, 14 * HOUR + 40 * 60_000, 21 * HOUR + 30 * 60_000];

const PRODUCTS = [
  { sku: "OM-AUD-001", name: "Audífonos inalámbricos Pulse", priceCents: 129_900, costCents: 74_000, stock: 120 },
  { sku: "OM-KBD-002", name: "Teclado mecánico Atlas 75%", priceCents: 189_900, costCents: 112_000, stock: 80 },
  { sku: "OM-MSE-003", name: "Mouse ergonómico Vertex", priceCents: 59_900, costCents: 31_000, stock: 200 },
  { sku: "OM-MON-004", name: 'Monitor 27" QHD Lumen', priceCents: 649_900, costCents: 452_000, stock: 35 },
  { sku: "OM-CAM-005", name: "Webcam 1080p Clarity", priceCents: 89_900, costCents: 48_000, stock: 90 },
  { sku: "OM-SSD-006", name: "SSD NVMe 1 TB Swift", priceCents: 149_900, costCents: 96_000, stock: 150 },
  { sku: "OM-HUB-007", name: "Hub USB-C 7 en 1", priceCents: 79_900, costCents: 38_000, stock: 140 },
  { sku: "OM-CHR-008", name: "Silla ergonómica Posture", priceCents: 489_900, costCents: 301_000, stock: 20 },
  { sku: "OM-LMP-009", name: "Lámpara LED de escritorio Halo", priceCents: 49_900, costCents: 22_000, stock: 110 },
  { sku: "OM-BAG-010", name: "Mochila para laptop Transit", priceCents: 99_900, costCents: 47_000, stock: 75 },
  { sku: "OM-SPK-011", name: "Bocina Bluetooth Wave", priceCents: 119_900, costCents: 68_000, stock: 60 },
  { sku: "OM-PAD-012", name: "Mousepad XL Grid", priceCents: 29_900, costCents: 11_000, stock: 300 },
];

const CUSTOMERS = [
  ["María López", "maria.lopez"],
  ["José Hernández", "jose.hernandez"],
  ["Guadalupe Martínez", "guadalupe.martinez"],
  ["Juan García", "juan.garcia"],
  ["Ana Rodríguez", "ana.rodriguez"],
  ["Luis Pérez", "luis.perez"],
  ["Fernanda Sánchez", "fernanda.sanchez"],
  ["Carlos Ramírez", "carlos.ramirez"],
  ["Sofía Torres", "sofia.torres"],
  ["Miguel Flores", "miguel.flores"],
  ["Valeria Gómez", "valeria.gomez"],
  ["Diego Díaz", "diego.diaz"],
  ["Camila Cruz", "camila.cruz"],
  ["Jorge Morales", "jorge.morales"],
  ["Daniela Reyes", "daniela.reyes"],
] as const;

// Reparto fijo de estados (i % 10): 21 PENDING, 21 PROCESSING, 21 SHIPPED,
// 32 DELIVERED, 10 CANCELLED. i = 0 (OM-E2E-0001) cae en PENDING.
const STATUS_CYCLE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.DELIVERED,
  OrderStatus.PENDING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.PROCESSING,
  OrderStatus.CANCELLED,
];

// Recorrido de estados que generó cada pedido (para order_status_events).
const STATUS_PATH: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PENDING],
  PROCESSING: [OrderStatus.PENDING, OrderStatus.PROCESSING],
  SHIPPED: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.SHIPPED],
  DELIVERED: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
  CANCELLED: [OrderStatus.PENDING, OrderStatus.CANCELLED],
};
const HOURS_BETWEEN_MOVES = 18;

// Partidas por pedido: ciclo de 7 que suma 15 → 225, más una partida extra en
// i = 0, 35, 70 → 228. Máximo 4 productos distintos por pedido.
const ITEMS_CYCLE = [3, 1, 2, 2, 4, 1, 2];
const itemsForOrder = (i: number) => ITEMS_CYCLE[i % 7] + (i % 35 === 0 ? 1 : 0);

export function buildSeedDataset() {
  const products = PRODUCTS.map((product, p) => ({
    id: seedUuid("a", p + 1),
    ...product,
    isActive: true,
    createdAt: new Date(FIRST_BUSINESS_DAY - 30 * DAY),
  }));

  const orders: (Prisma.OrderCreateManyInput & { status: OrderStatus })[] = [];
  const orderItems: Prisma.OrderItemCreateManyInput[] = [];
  const statusEvents: (Prisma.OrderStatusEventCreateManyInput & { createdAt: Date })[] = [];

  for (let i = 0; i < SEED_COUNTS.orders; i++) {
    const id = seedUuid("b", i + 1);
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const createdAt = new Date(FIRST_BUSINESS_DAY + Math.floor(i / 3) * DAY + DAILY_SLOTS[i % 3]);
    const [customerName, emailUser] = CUSTOMERS[(i * 7) % CUSTOMERS.length];

    let totalCents = 0;
    let costCents = 0;
    for (let k = 0; k < itemsForOrder(i); k++) {
      // 3k mod 12 es distinto para k = 0..3 → sin productos repetidos en el pedido.
      const product = products[(i * 5 + k * 3) % products.length];
      const quantity = 1 + ((i + 2 * k) % 3);
      totalCents += quantity * product.priceCents;
      costCents += quantity * product.costCents;
      orderItems.push({
        id: seedUuid("c", orderItems.length + 1),
        orderId: id,
        productId: product.id,
        quantity,
        unitPriceCents: product.priceCents,
        unitCostCents: product.costCents,
      });
    }

    const path = STATUS_PATH[status];
    path.forEach((toStatus, step) => {
      statusEvents.push({
        orderId: id,
        fromStatus: step === 0 ? null : path[step - 1],
        toStatus,
        createdAt: new Date(createdAt.getTime() + step * HOURS_BETWEEN_MOVES * HOUR),
      });
    });

    orders.push({
      id,
      orderNumber: `OM-E2E-${String(i + 1).padStart(4, "0")}`,
      customerName,
      customerEmail: `${emailUser}@example.com`,
      status,
      position: "", // se asigna abajo, por columna
      version: path.length,
      totalCents,
      costCents,
      createdAt,
      updatedAt: statusEvents[statusEvents.length - 1].createdAt,
    });
  }

  // Posiciones fraccionales por columna, en orden de número de pedido: la
  // primera tarjeta de cada columna es el pedido más antiguo con ese estado.
  for (const status of Object.values(OrderStatus)) {
    const column = orders.filter((order) => order.status === status);
    const keys = generateNKeysBetween(null, null, column.length);
    column.forEach((order, index) => (order.position = keys[index]));
  }

  return { products, orders, orderItems, statusEvents };
}

export type SeedDataset = ReturnType<typeof buildSeedDataset>;
