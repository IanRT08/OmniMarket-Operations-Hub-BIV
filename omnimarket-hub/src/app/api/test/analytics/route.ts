import type { NextRequest } from "next/server";
import { z } from "zod";
import { analyticsQuerySchema } from "@/features/analytics/schemas";
import { getSalesAnalytics } from "@/server/dal/analytics";
import { createTimer, errorResponse, jsonResponse, unexpectedErrorResponse } from "@/server/http";
import { guardTestEndpoint } from "@/server/test-guard";

// GET /api/test/analytics?page=1&limit=50 — endpoint de auditoría de solo lectura.
//
// SLA < 300 ms: lee la tabla pre-agregada daily_sales_metrics (ver DAL). En
// producción la latencia la domina la red función↔BD: la región de las
// funciones debe coincidir con la de la BD. En Next 16 `preferredRegion` está
// deprecado; la región se fija en vercel.json ("regions": ["iad1"]), así que
// la BD debe vivir en us-east-1.
export async function GET(request: NextRequest) {
  const timer = createTimer();

  const blocked = guardTestEndpoint();
  if (blocked) return blocked;

  const query = analyticsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) {
    return errorResponse(
      timer,
      400,
      "INVALID_QUERY",
      "Parámetros page/limit inválidos",
      z.flattenError(query.error).fieldErrors,
    );
  }

  try {
    const analytics = await timer.measure("db", () => getSalesAnalytics(query.data));
    return jsonResponse(timer, analytics);
  } catch (error) {
    return unexpectedErrorResponse(timer, error);
  }
}
