import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsSkeleton } from "@/features/analytics/components/analytics-skeleton";

export default function DashboardLoading() {
  return (
    <>
      <PageHeader title="Dashboard" description="Ventas, ticket promedio, margen y estado de los pedidos." />
      <AnalyticsSkeleton />
    </>
  );
}
