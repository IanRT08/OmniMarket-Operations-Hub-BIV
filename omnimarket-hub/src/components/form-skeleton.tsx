import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton genérico de formulario por secciones (alta de pedido y de producto). */
export function FormSkeleton({ sections = [2, 2] }: { sections?: number[] }) {
  return (
    <div role="status" aria-label="Cargando formulario" className="flex max-w-3xl flex-col gap-6">
      {sections.map((fields, section) => (
        <div key={section} className="rounded-xl border border-border bg-white p-5">
          <Skeleton className="mb-4 h-5 w-28" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: fields }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-11 w-36" />
      </div>
      <span className="sr-only">Cargando formulario…</span>
    </div>
  );
}
