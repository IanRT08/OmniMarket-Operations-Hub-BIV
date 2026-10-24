import { expect, test } from "@playwright/test";

// Flujo 1: autenticación. Redirección de rutas privadas sin sesión y acceso
// con la sesión simulada que crea auth.setup.ts (nunca se toca Google/GitHub).
// No prueba "Salir": Better Auth borraría la sesión E2E que usan los demás specs.

const PRIVATE_ROUTES = ["/dashboard", "/orders", "/orders/new", "/kanban", "/products", "/products/new"];

test.describe("sin sesión", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of PRIVATE_ROUTES) {
    test(`${path} redirige a /login conservando la ruta`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(
        (url) => url.pathname === "/login" && url.searchParams.get("callbackUrl") === path,
      );
      await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continuar con GitHub" })).toBeVisible();
    });
  }

  test("la raíz manda al dashboard, que también exige sesión", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(
      (url) => url.pathname === "/login" && url.searchParams.get("callbackUrl") === "/dashboard",
    );
  });

  test("una cookie de sesión falsificada no da acceso", async ({ page, context, baseURL }) => {
    // proxy.ts solo revisa que la cookie exista y la deja pasar; la validación
    // real (firma + sesión en BD) la hace requireSession() en el layout.
    await context.addCookies([{ name: "better-auth.session_token", value: "token-falso.firma-falsa", url: baseURL! }]);

    await page.goto("/orders");

    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(page.getByRole("heading", { name: "OmniMarket Operations Hub" })).toBeVisible();
    await expect(page.getByTestId("orders-table")).toHaveCount(0);
  });
});

test.describe("con sesión simulada", () => {
  test("accede a las rutas privadas y ve su usuario", async ({ page }) => {
    for (const path of PRIVATE_ROUTES) {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === path);
    }
    await expect(page.getByRole("banner")).toContainText("Auditor E2E");
  });

  test("/login redirige al dashboard si ya hay sesión", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard");
  });

  test("respeta callbackUrl internos e ignora los externos (sin redirección abierta)", async ({ page }) => {
    await page.goto("/login?callbackUrl=/kanban");
    await expect(page).toHaveURL((url) => url.pathname === "/kanban");

    await page.goto("/login?callbackUrl=//sitio-malicioso.example");
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard" && url.hostname === "localhost");
  });
});
