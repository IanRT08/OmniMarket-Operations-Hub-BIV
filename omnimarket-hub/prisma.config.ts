import "dotenv/config";
import { defineConfig } from "prisma/config";

// La CLI (migrate, db seed, studio) usa la conexión DIRECTA: las migraciones
// necesitan locks de sesión que un pooler en modo transacción no garantiza.
// El runtime de la app usa DATABASE_URL (pooled) desde src/server/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // --conditions=react-server: permite importar módulos con "server-only"
    // fuera de Next, así el CLI ejecuta exactamente la misma función que
    // POST /api/test/reset-data.
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
