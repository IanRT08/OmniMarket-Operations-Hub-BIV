import { cn } from "@/lib/utils";

const FIELD_CLASSES =
  "h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink placeholder:text-ink-muted/70 " +
  "transition-colors hover:border-brand-olive focus-visible:border-brand-olive focus-visible:outline-2 " +
  "focus-visible:outline-brand-lime disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-invalid:border-rose-500 aria-invalid:focus-visible:outline-rose-400";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(FIELD_CLASSES, "pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-ink", className)} {...props} />;
}

/** Mensaje de error de un campo; el input lo referencia con aria-describedby. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-rose-700">
      {message}
    </p>
  );
}

/** Checkbox con el color de la paleta (accent-color). */
export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 cursor-pointer rounded border-border accent-brand-moss", className)}
      {...props}
    />
  );
}
