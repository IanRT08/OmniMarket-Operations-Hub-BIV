import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { KanbanBoard } from "@/features/kanban/components/kanban-board.client";
import { KanbanPageHeader } from "@/features/kanban/components/kanban-page-header";
import { kanbanBoardQueryOptions } from "@/features/kanban/queries";

export const metadata: Metadata = { title: "Kanban" };

// RSC: precarga el tablero en el servidor y lo entrega hidratado al cache de
// TanStack Query, así el cliente pinta las tarjetas sin una segunda petición.
// Mientras tanto, loading.tsx muestra el skeleton.
export default async function KanbanPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(kanbanBoardQueryOptions());

  return (
    <>
      <KanbanPageHeader />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <KanbanBoard />
      </HydrationBoundary>
    </>
  );
}
