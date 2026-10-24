import { expect, test } from "@playwright/test";

// Flujo 2: registro de nuevo producto/pedido y validación de su reflejo en la
// tabla, más el Bulk Update de la tabla de pedidos. Corre después de
// auth.setup.ts (dataset recién sembrado). No toca OM-E2E-0001, que es el
// pedido que arrastra kanban-dnd.spec.ts.
test.describe.configure({ mode: "serial" });

const VERTEX_MOUSE_ID = "a0000000-0000-4000-8000-000000000003"; // seed: $599.00, stock 200

test("crea un producto y aparece en la tabla de productos", async ({ page }) => {
  await page.goto("/products/new");
  await page.getByLabel("SKU").fill("om-e2e-900");
  await page.getByLabel("Nombre").fill("Base para laptop E2E");
  await page.getByLabel("Precio de venta (MXN)").fill("499.90");
  await page.getByLabel("Costo (MXN)").fill("250");
  await page.getByLabel("Stock inicial").fill("15");
  await page.getByRole("button", { name: "Crear producto" }).click();

  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText("Producto OM-E2E-900 creado")).toBeVisible();
  const row = page.getByTestId("product-row-OM-E2E-900");
  await expect(row).toContainText("Base para laptop E2E");
  await expect(row).toContainText("$499.90");
});

test("crea un pedido y aparece al inicio de la tabla de pedidos", async ({ page }) => {
  await page.goto("/orders/new");
  await page.getByLabel("Nombre").fill("Cliente Playwright");
  await page.getByLabel("Email").fill("playwright@example.com");
  await page.getByLabel("Producto", { exact: true }).selectOption(VERTEX_MOUSE_ID);
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await expect(page.getByTestId("order-total")).toHaveText("$1,198.00");

  await page.getByRole("button", { name: "Crear pedido" }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText(/^Pedido OM-\d{6}-[0-9A-Z]{6} creado$/)).toBeVisible();
  const firstRow = page.getByTestId("orders-table").locator("tbody tr").first();
  await expect(firstRow).toContainText("Cliente Playwright");
  await expect(firstRow).toContainText("Pendiente");
  await expect(firstRow).toContainText("$1,198.00");
});

test("Bulk Update: cambia el estado de varios pedidos y persiste", async ({ page }) => {
  await page.goto("/orders");
  const rows = ["OM-E2E-0105", "OM-E2E-0104"].map((n) => page.getByTestId(`order-row-${n}`));
  for (const row of rows) await row.getByRole("checkbox").check();

  const bar = page.getByRole("region", { name: "Acciones en lote" });
  await expect(bar).toContainText("2 pedidos seleccionados");
  await bar.getByLabel("Cambiar estado a").selectOption("SHIPPED");
  await bar.getByRole("button", { name: "Aplicar" }).click();

  // Optimista + toast de confirmación.
  for (const row of rows) await expect(row).toContainText("Enviado");
  await expect(page.getByText("2 pedidos movidos a Enviado")).toBeVisible();
  await expect(bar).toBeHidden(); // la selección se limpia al confirmar

  // Persistencia real en la BD.
  for (const orderNumber of ["OM-E2E-0105", "OM-E2E-0104"]) {
    const response = await page.request.get(`/api/test/kanban-status?orderId=${orderNumber}`);
    const { data } = await response.json();
    expect(data.order.status).toBe("SHIPPED");
    expect(data.lastEvent).toMatchObject({ fromStatus: "DELIVERED", toStatus: "SHIPPED" });
  }
});
