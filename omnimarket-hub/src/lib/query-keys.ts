import type { OrderListQuery } from "@/features/orders/schemas";

// Llaves de TanStack Query centralizadas: el prefetch del RSC, los hooks y
// las invalidaciones usan exactamente las mismas.
export const queryKeys = {
  kanban: {
    all: ["kanban"] as const,
    board: () => [...queryKeys.kanban.all, "board"] as const,
  },
  orders: {
    all: ["orders"] as const,
    lists: () => [...queryKeys.orders.all, "list"] as const,
    // La consulta normalizada completa va en la llave: cada página/filtro es
    // una entrada de cache distinta.
    list: (query: OrderListQuery) => [...queryKeys.orders.lists(), query] as const,
  },
} as const;

export const mutationKeys = {
  moveOrder: ["kanban", "move-order"] as const,
  bulkUpdate: ["orders", "bulk-update"] as const,
  createOrder: ["orders", "create"] as const,
  createProduct: ["products", "create"] as const,
} as const;
