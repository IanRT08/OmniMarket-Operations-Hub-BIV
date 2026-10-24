import { expect, test } from "@playwright/test";

// Dashboard de KPIs: indicadores, gráfica con su tabla equivalente, conteo
// por estado y cambio de rango sin recargar la página.

test("muestra KPIs, gráfica de ingresos y pedidos por estado", async ({ page }) => {
  await page.goto("/dashboard");

  for (const label of ["Ingresos", "Pedidos", "Ticket promedio", "Margen bruto"]) {
    await expect(page.getByTestId(`kpi-${label}`)).toContainText(/\d/);
  }

  // La gráfica dibuja columnas (SVG de Recharts) y tiene una tabla equivalente.
  const chart = page.getByRole("img", { name: /Gráfica de ingresos diarios/ });
  await expect(chart.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await page.getByText("Ver datos en tabla").click();
  await expect(page.locator("details table tbody tr")).toHaveCount(30);

  // Los 5 estados con su conteo; suman el total del encabezado de la tarjeta.
  const counts = await Promise.all(
    ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map(async (status) =>
      Number((await page.getByTestId(`status-count-${status}`).innerText()).match(/\d+/)![0]),
    ),
  );
  const total = counts.reduce((a, b) => a + b, 0);
  await expect(page.getByText(`${total} pedidos en total`)).toBeVisible();
});

test("cambia el rango a 7 días sin recargar y lo guarda en la URL", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Últimos 7 días" }).click();

  await expect(page).toHaveURL(/\?days=7$/);
  await expect(page.getByRole("button", { name: "Últimos 7 días" })).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Ver datos en tabla").click();
  await expect(page.locator("details table tbody tr")).toHaveCount(7);
});
