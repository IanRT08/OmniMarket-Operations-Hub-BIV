import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// ============================================================================
// Cliente Prisma (ORM 7 + driver adapter node-postgres)
// ----------------------------------------------------------------------------
// DATABASE_URL debe ser la URL *pooled* del proveedor (Neon: host "-pooler";
// Supabase/Railway: PgBouncer en modo transacción). adapter-pg envía
// consultas sin prepared statements con nombre, así que es compatible con
// poolers en modo transacción, incluidas las transacciones interactivas.
//
// El pool local es deliberadamente pequeño: en serverless cada instancia
// abre su propio pool y el pooler del proveedor es quien multiplexa. Con
// DB_POOL_MAX se ajusta sin tocar código (mínimo 3: analytics lanza 3
// consultas en paralelo).
//
// No se valida DATABASE_URL aquí: `next build` importa los route handlers
// para leer su configuración y no debe exigir una BD. pg no conecta hasta la
// primera consulta.
// ============================================================================

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Una sola instancia por proceso: el HMR de `next dev` re-evalúa los módulos
// y, sin esto, abriría un pool nuevo en cada recarga.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
