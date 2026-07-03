import { InputHTMLAttributes, forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/** Input base — ver Design/design.md, sección Componentes > Input. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-[42px] w-full rounded-input border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-[0_0_0_2px_var(--color-neutral-50),0_0_0_4px_var(--color-brand-500)] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
          error && "border-error-500",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-22 w-full resize-y rounded-input border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-normal text-neutral-950 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-brand-500 focus:shadow-[0_0_0_2px_var(--color-neutral-50),0_0_0_4px_var(--color-brand-500)] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
          error && "border-error-500",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block font-sans text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-600",
        className
      )}
      {...props}
    />
  );
}
