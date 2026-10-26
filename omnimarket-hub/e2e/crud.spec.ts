import { expect, test, type Page } from "@playwright/test";

// CRUD completo desde la UI: editar y eliminar productos y pedidos, con su
// toast y la persistencia verificada en la BD. No toca OM-E2E-0001 (Kanban)
// ni OM-E2E-0104/0105 (Bulk Update de create-order.spec.ts).
test.describe.configure({ mode: "serial" });

async function kanbanStatus(page: Page, orderNumber: string) {
  const response = await page.request.get(`/api/test/kanban-status?orderId=${orderNumber}`);
  return { status: response.status(), body: await response.json() };
}

test("edita un producto: nombre, precio y ajuste de stock", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("link", { name: "Editar OM-PAD-012" }).click();

  await expect(page.getByRole("heading", { name: "Editar OM-PAD-012" })).toBeVisible();
  await expect(page.getByLabel("SKU")).toHaveValue("OM-PAD-012");
  await page.getByLabel("Nombre").fill("Mousepad XXL Grid");
  await page.getByLabel("Precio de venta (MXN)").fill("349.90");
  await page.getByLabel("Ajuste de stock").fill("10");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText("Producto OM-PAD-012 actualizado")).toBeVisible();
  const row = page.getByTestId("product-row-OM-PAD-012");
  await expect(row).toContainText("Mousepad XXL Grid");
  await expect(row).toContainText("$349.90");
});

test("un producto con ventas no se elimina: se ofrece desactivarlo", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("button", { name: "Eliminar OM-AUD-001" }).click();
  const dialog = page.getByRole("dialog", { name: "¿Eliminar OM-AUD-001?" });
  await dialog.getByRole("button", { name: "Eliminar producto" }).click();

  await expect(page.getByText("No se puede eliminar OM-AUD-001")).toBeVisible();
  await expect(page.getByRole("button", { name: "Desactivar" })).toBeVisible();
  await expect(page.getByTestId("product-row-OM-AUD-001")).toBeVisible();
});

test("elimina un producto sin ventas y desaparece de la tabla", async ({ page }) => {
  // SKU único por corrida: los reintentos de CI no chocan con SKU_TAKEN.
  const sku = `OM-DEL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  await page.goto("/products/new");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre").fill("Producto temporal E2E");
  await page.getByLabel("Precio de venta (MXN)").fill("100");
  await page.getByLabel("Costo (MXN)").fill("50");
  await page.getByLabel("Stock inicial").fill("3");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByTestId(`product-row-${sku}`)).toBeVisible();

  await page.getByRole("button", { name: `Eliminar ${sku}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar producto" }).click();

  await expect(page.getByText(`Producto ${sku} eliminado`)).toBeVisible();
  await expect(page.getByTestId(`product-row-${sku}`)).toBeHidden();
});

test("edita cliente y estado de un pedido y persiste en la BD", async ({ page }) => {
  // OM-E2E-0050 está CANCELLED en el seed: reactivarlo descuenta stock y suma métricas.
  await page.goto("/orders?q=OM-E2E-0050");
  await page.getByRole("link", { name: "Editar OM-E2E-0050" }).click();

  await expect(page.getByRole("heading", { name: "Editar OM-E2E-0050" })).toBeVisible();
  await page.getByLabel("Nombre").fill("Cliente Editado E2E");
  await page.getByLabel("Estado").selectOption("PROCESSING");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText("Pedido OM-E2E-0050 actualizado")).toBeVisible();

  const { body } = await kanbanStatus(page, "OM-E2E-0050");
  expect(body.data.order.status).toBe("PROCESSING");
  expect(body.data.lastEvent).toMatchObject({ fromStatus: "CANCELLED", toStatus: "PROCESSING" });

  await page.goto("/orders?q=OM-E2E-0050");
  const row = page.getByTestId("order-row-OM-E2E-0050");
  await expect(row).toContainText("Cliente Editado E2E");
  await expect(row).toContainText("En proceso");
});

test("elimina un pedido de la tabla y ya no existe en la BD", async ({ page }) => {
  await page.goto("/orders?q=OM-E2E-0058");
  const row = page.getByTestId("order-row-OM-E2E-0058");
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Eliminar OM-E2E-0058" }).click();
  await page.getByRole("dialog", { name: "¿Eliminar OM-E2E-0058?" }).getByRole("button", { name: "Eliminar pedido" }).click();

  // Optimista + toast de confirmación.
  await expect(row).toBeHidden();
  await expect(page.getByText("Pedido OM-E2E-0058 eliminado")).toBeVisible();

  const { status, body } = await kanbanStatus(page, "OM-E2E-0058");
  expect(status).toBe(404);
  expect(body.error.code).toBe("ORDER_NOT_FOUND");
});
