import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 border border-brand-500 text-white hover:bg-brand-600 hover:border-brand-600",
  secondary:
    "bg-transparent border border-neutral-300 text-neutral-950 hover:bg-neutral-950/4",
  ghost:
    "bg-transparent border border-transparent text-neutral-950 hover:bg-neutral-950/4",
  destructive:
    "bg-error-500 border border-error-500 text-white hover:bg-error-700 hover:border-error-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-1.5",
  lg: "h-11 px-5 text-sm gap-2",
};

/**
 * Clases del botón, expuestas aparte para poder darle la misma apariencia
 * a elementos que no son un <button> (p. ej. un <Link> de next/navigation).
 */
export function buttonVariants(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-none font-mono font-medium tracking-[-0.01em] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/** Botón base del design system — ver Design/design.md, sección Componentes > Botón. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonVariants(variant, size, className)}
        {...props}
      >
        {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
