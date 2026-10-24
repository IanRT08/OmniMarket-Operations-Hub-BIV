import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardView } from "@/features/analytics/components/dashboard-view.client";
import { dashboardKpisQueryOptions } from "@/features/analytics/queries";
import { parseDashboardRange } from "@/features/analytics/schemas";

export const metadata: Metadata = { title: "Dashboard" };

// RSC: precarga los KPIs (lectura cacheada con el tag `analytics`) y los
// entrega hidratados a TanStack Query, que luego los refresca cada 30 s.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const days = parseDashboardRange((await searchParams).days);
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(dashboardKpisQueryOptions(days));

  return (
    <>
      <PageHeader title="Dashboard" description="Ventas, ticket promedio, margen y estado de los pedidos." />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardView />
      </HydrationBoundary>
    </>
  );
}
