import { KanbanPageHeader } from "@/features/kanban/components/kanban-page-header";
import { KanbanBoardSkeleton } from "@/features/kanban/components/kanban-skeleton";

export default function KanbanLoading() {
  return (
    <>
      <KanbanPageHeader />
      <KanbanBoardSkeleton />
    </>
  );
}
