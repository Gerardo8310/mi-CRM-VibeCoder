import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "brand" | "success" | "error" | "warning" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-600",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-100 text-success-700",
  error: "bg-error-100 text-error-700",
  warning: "bg-warning-100 text-warning-700",
  info: "bg-info-100 text-info-700",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** Insignia base — ver Design/design.md, sección Componentes > Badge. */
export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-badge px-1.75 py-0.75 font-sans text-xs font-medium leading-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
