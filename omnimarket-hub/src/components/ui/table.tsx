import { cn } from "@/lib/utils";

// Primitivas de tabla (estilo shadcn/ui) con la paleta: encabezado en mint
// suave, bordes neutros y fila seleccionada resaltada.

export function TableContainer({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("overflow-x-auto rounded-xl border border-border bg-white", className)} {...props} />;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-brand-mint/30 text-left", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors last:border-0 hover:bg-surface",
        "data-[selected=true]:bg-brand-mint/20",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("h-11 px-4 text-xs font-semibold tracking-wide whitespace-nowrap text-ink uppercase", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle text-ink", className)} {...props} />;
}
