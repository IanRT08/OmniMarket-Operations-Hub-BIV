import { Skeleton } from "@/components/ui/skeleton";

export default function EditOrderLoading() {
  return (
    <div role="status" aria-label="Cargando pedido">
      <div className="mb-5 flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-white p-5">
            <Skeleton className="mb-4 h-5 w-36" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-11 w-40" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Cargando pedido…</span>
    </div>
  );
}
