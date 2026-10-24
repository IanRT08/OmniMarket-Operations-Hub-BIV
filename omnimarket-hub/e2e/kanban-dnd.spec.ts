import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_ORDER_NUMBER } from "./fixtures/seed-ids";

// Flujo 3: Drag & Drop en el Kanban. Corre después de auth.setup.ts (reset
// del dataset + sesión), así OM-E2E-0001 es la primera tarjeta de PENDING.
// Serial: el segundo test depende de que el primero deje la tarjeta en su lugar.
test.describe.configure({ mode: "serial" });

const cardSelector = `order-card-${E2E_ORDER_NUMBER}`;

// locator.dragTo() no siempre activa el PointerSensor de dnd-kit: se arrastra
// con el mouse por pasos (primero > 6 px para activar, luego hasta el destino).
async function dragCard(page: Page, card: Locator, target: Locator) {
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY + 4, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 90, { steps: 15 });
  await page.mouse.up();
}

async function kanbanStatus(page: Page) {
  const response = await page.request.get(`/api/test/kanban-status?orderId=${E2E_ORDER_NUMBER}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/kanban");
  await expect(page.getByTestId("kanban-column-PENDING").getByTestId(cardSelector)).toBeVisible();
});

test("rollback visual y toast de error si el servidor no confirma el movimiento", async ({ page }) => {
  // Corta las Server Actions (moveOrder y el refetch del tablero) a nivel de red.
  await page.route("**/kanban", (route) =>
    route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue(),
  );

  const pending = page.getByTestId("kanban-column-PENDING");
  await dragCard(page, pending.getByTestId(cardSelector), page.getByTestId("kanban-column-SHIPPED"));

  await expect(page.getByText(`No se pudo mover ${E2E_ORDER_NUMBER}`)).toBeVisible();
  await expect(pending.getByTestId(cardSelector)).toBeVisible();
  await expect(page.getByTestId("kanban-column-SHIPPED").getByTestId(cardSelector)).toHaveCount(0);

  // La BD nunca cambió.
  expect((await kanbanStatus(page)).order.status).toBe("PENDING");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("arrastra OM-E2E-0001 de Pendiente a En proceso y persiste en la BD", async ({ page }) => {
  const processing = page.getByTestId("kanban-column-PROCESSING");
  await dragCard(page, page.getByTestId(cardSelector), processing);

  // 1. Cambio visual inmediato (optimista) y toast de éxito.
  await expect(processing.getByTestId(cardSelector)).toBeVisible();
  await expect(page.getByText(`${E2E_ORDER_NUMBER} movido a En proceso`)).toBeVisible();

  // 2. Persistencia real, no solo el cambio en el DOM.
  await expect.poll(async () => (await kanbanStatus(page)).order.status).toBe("PROCESSING");
  const { lastEvent } = await kanbanStatus(page);
  expect(lastEvent).toMatchObject({ fromStatus: "PENDING", toStatus: "PROCESSING", actorId: "e2e-user" });

  // 3. Tras recargar, el tablero sale de la BD con la tarjeta en su nueva columna.
  await page.reload();
  await expect(processing.getByTestId(cardSelector)).toBeVisible();
});
