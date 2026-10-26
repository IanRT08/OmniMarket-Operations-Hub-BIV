import { expect, test } from "@playwright/test";
import { E2E_ORDER_ID } from "./fixtures/seed-ids";

// Criterio 1 de la matriz: "renderizado sin errores de consola". Recorre las
// páginas del dashboard (solo lectura) y falla con cualquier console.error,
// error no capturado o hidratación fallida.
const PAGES = [
  "/dashboard",
  "/orders",
  "/orders/new",
  `/orders/${E2E_ORDER_ID}/edit`,
  "/kanban",
  "/products",
  "/products/new",
  "/products/a0000000-0000-4000-8000-000000000001/edit", // OM-AUD-001 del seed
];

for (const path of PAGES) {
  test(`${path} renderiza sin errores de consola`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });
}
