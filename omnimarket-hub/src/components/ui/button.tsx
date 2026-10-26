import { cn } from "@/lib/utils";

const VARIANTS = {
  // blanco sobre moss 5.1:1; hover a moss-dark 7.1:1
  primary: "bg-brand-moss text-white hover:bg-brand-moss-dark",
  // ink sobre sage 7.9:1
  secondary: "bg-brand-sage text-ink hover:bg-brand-mint",
  outline: "border border-brand-olive bg-white text-ink hover:bg-brand-mint/40",
  ghost: "text-ink-muted hover:bg-brand-mint/40 hover:text-ink",
  // acciones destructivas: blanco sobre rose-700 6.4:1
  danger: "bg-rose-700 text-white hover:bg-rose-800",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
} as const;

type ButtonStyle = { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES; className?: string };

/** Clases de botón reutilizables en otros elementos (p. ej. <Link> con aspecto de botón). */
export function buttonClasses({ variant = "primary", size = "md", className }: ButtonStyle = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export type ButtonProps = React.ComponentProps<"button"> & Omit<ButtonStyle, "className">;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
