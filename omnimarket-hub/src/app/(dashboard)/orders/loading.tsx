import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdersTableSkeleton } from "@/features/orders/components/orders-table-skeleton";

export default function OrdersLoading() {
  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Filtra, selecciona varios pedidos y cambia su estado en lote."
        action={<Skeleton className="h-10 w-36 rounded-lg" />}
      />
      <OrdersTableSkeleton />
    </>
  );
}
