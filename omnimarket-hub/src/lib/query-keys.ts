// Llaves de TanStack Query centralizadas: el prefetch del RSC, los hooks y
// las invalidaciones usan exactamente las mismas.
export const queryKeys = {
  kanban: {
    all: ["kanban"] as const,
    board: () => [...queryKeys.kanban.all, "board"] as const,
  },
} as const;

export const mutationKeys = {
  moveOrder: ["kanban", "move-order"] as const,
} as const;
