import { revalidateTag } from "next/cache";
import { ANALYTICS_CACHE_TAG } from "@/server/dal/analytics";
import { resetTestData } from "@/server/dal/test-data";
import { createTimer, jsonResponse, unexpectedErrorResponse } from "@/server/http";
import { guardAuditToken } from "@/server/test-guard";

// Holgura para el cold start de una BD serverless; el reset en sí tarda < 1 s.
export const maxDuration = 30;

// POST /api/test/reset-data — header requerido: x-audit-token: <AUDIT_TOKEN>
// Restaura el dataset estático (ver src/server/dal/test-data.ts).
export async function POST(request: Request) {
  const timer = createTimer();

  const blocked = guardAuditToken(request);
  if (blocked) return blocked;

  try {
    const summary = await timer.measure("reset", () => resetTestData());
    // { expire: 0 }: los KPIs cacheados no deben servirse ni una vez más tras el reset.
    revalidateTag(ANALYTICS_CACHE_TAG, { expire: 0 });
    return jsonResponse(timer, { ok: true, data: summary });
  } catch (error) {
    return unexpectedErrorResponse(timer, error);
  }
}
