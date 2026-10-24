import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./e2e/fixtures/seed-ids";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// El servidor de prueba escucha en el puerto de baseURL, así un `next dev`
// en el 3000 (con la BD real del .env) nunca se reutiliza por accidente.
const port = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // todos los specs comparten la BD: evita carreras
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    // reset-data + sesión simulada → storageState
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
