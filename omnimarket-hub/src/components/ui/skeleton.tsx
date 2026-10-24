import { cn } from "@/lib/utils";

/** Bloque de carga (shadcn/ui) con el tono sage de la paleta. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-brand-sage/35", className)}
      {...props}
    />
  );
}
