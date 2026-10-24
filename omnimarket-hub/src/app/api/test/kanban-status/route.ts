import type { NextRequest } from "next/server";
import { z } from "zod";
import { getOrderKanbanStatus } from "@/server/dal/orders";
import { createTimer, errorResponse, jsonResponse, unexpectedErrorResponse } from "@/server/http";
import { guardTestEndpoint } from "@/server/test-guard";

// Sin caché: la prueba E2E consulta este endpoint justo después de soltar la
// tarjeta y debe ver el movimiento persistido, no una respuesta previa.
export const dynamic = "force-dynamic";

const kanbanStatusQuerySchema = z.object({
  // UUID del pedido o su número (p. ej. OM-E2E-0001).
  orderId: z.string().trim().min(1).max(64),
});

// GET /api/test/kanban-status?orderId=… — último evento registrado de un pedido.
export async function GET(request: NextRequest) {
  const timer = createTimer();

  const blocked = guardTestEndpoint();
  if (blocked) return blocked;

  const query = kanbanStatusQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) {
    return errorResponse(
      timer,
      400,
      "INVALID_QUERY",
      "Parámetro orderId requerido",
      z.flattenError(query.error).fieldErrors,
    );
  }

  try {
    const status = await timer.measure("db", () => getOrderKanbanStatus(query.data.orderId));
    if (!status) {
      return errorResponse(timer, 404, "ORDER_NOT_FOUND", `No existe el pedido ${query.data.orderId}`);
    }
    return jsonResponse(timer, { ok: true, data: status });
  } catch (error) {
    return unexpectedErrorResponse(timer, error);
  }
}
