import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Tarjeta base — ver Design/design.md, sección Componentes > Card. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border border-neutral-200 bg-white p-6 shadow-xs",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between border-b border-neutral-200 pb-4",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-mono text-base font-semibold tracking-[-0.02em] text-neutral-950",
        className
      )}
      {...props}
    />
  );
}
