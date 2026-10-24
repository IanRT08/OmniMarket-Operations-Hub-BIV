import { queryOptions } from "@tanstack/react-query";
import { fetchKanbanBoard } from "@/features/kanban/actions";
import { queryKeys } from "@/lib/query-keys";

/** Opciones compartidas por el prefetch del RSC (page.tsx) y useQuery en el cliente. */
export const kanbanBoardQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.kanban.board(),
    queryFn: () => fetchKanbanBoard(),
    staleTime: 15_000,
  });

/** "Tiempo real" ligero: refresca el tablero para ver movimientos de otros usuarios. */
export const KANBAN_REFETCH_INTERVAL_MS = 20_000;
