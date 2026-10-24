import { expect, test } from "@playwright/test";

// Criterio 1 de la matriz: "renderizado sin errores de consola". Recorre las
// páginas del dashboard (solo lectura) y falla con cualquier console.error,
// error no capturado o hidratación fallida.
const PAGES = ["/orders", "/orders/new", "/kanban", "/products", "/products/new"];

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
