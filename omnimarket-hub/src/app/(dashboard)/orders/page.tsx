import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { OrdersTable } from "@/features/orders/components/orders-table.client";
import { ordersListQueryOptions } from "@/features/orders/queries";
import { parseOrderListQuery } from "@/features/orders/schemas";

export const metadata: Metadata = { title: "Pedidos" };

// RSC: precarga la página pedida en la URL (filtros incluidos) con la misma
// llave que usará useQuery; loading.tsx muestra el skeleton mientras tanto.
export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const query = parseOrderListQuery(await searchParams);
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(ordersListQueryOptions(query));

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Filtra, selecciona varios pedidos y cambia su estado en lote."
        action={
          <Link href="/orders/new" className={buttonClasses()}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo pedido
          </Link>
        }
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OrdersTable />
      </HydrationBoundary>
    </>
  );
}
