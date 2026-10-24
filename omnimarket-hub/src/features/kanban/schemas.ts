import "@/lib/zod-locale";
import { z } from "zod";
import { OrderStatus } from "@/generated/prisma/enums";
import { isValidPosition } from "@/lib/position";

export const moveOrderSchema = z.object({
  orderId: z.uuid(),
  toStatus: z.enum(OrderStatus),
  /** Llave fraccional calculada en el cliente con positionBetween() (src/lib/position.ts). */
  position: z.string().refine(isValidPosition, { message: "Posición fraccional inválida" }),
  /** Versión que el cliente vio al arrastrar (concurrencia optimista). */
  version: z.number().int().min(1),
});

export type MoveOrderInput = z.input<typeof moveOrderSchema>;
export type MoveOrderData = z.output<typeof moveOrderSchema>;
