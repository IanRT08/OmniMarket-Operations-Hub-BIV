import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductsTableSkeletonRows } from "@/features/products/components/products-table";

export default function ProductsLoading() {
  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo con precio, costo, margen e inventario disponible."
        action={<Skeleton className="h-10 w-40 rounded-lg" />}
      />
      {/* Misma geometría que el formulario de búsqueda: etiqueta + campo, casilla y botón. */}
      <div className="mb-4 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-10 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-24" />
      </div>
      <ProductsTableSkeletonRows />
    </>
  );
}
