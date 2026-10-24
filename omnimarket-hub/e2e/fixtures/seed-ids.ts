// IDs fijos del dataset de prueba. Se re-exportan desde el seed para que
// los specs y POST /api/test/reset-data nunca diverjan.
export { E2E_ORDER_ID, E2E_ORDER_NUMBER, SEED_COUNTS } from "@/server/seed/dataset";

/** Sesión simulada que escribe auth.setup.ts y reutilizan los specs. */
export const STORAGE_STATE = "e2e/.auth/user.json";
