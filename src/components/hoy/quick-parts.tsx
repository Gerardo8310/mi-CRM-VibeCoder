import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Etiqueta pequeña de cada bloque de alta rápida (ícono + texto en versalitas). */
export function QuickBlockLabel({
  icon,
  iconWrapClass,
  label,
}: {
  icon: ReactNode;
  iconWrapClass: string;
  label: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full",
          iconWrapClass
        )}
      >
        {icon}
      </span>
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-600">
        {label}
      </span>
    </div>
  );
}

/** Botón disparador punteado (estado inicial de cada bloque). */
export function QuickTrigger({
  onClick,
  icon,
  iconWrapClass,
  title,
  subtitle,
  borderClass,
}: {
  onClick: () => void;
  icon: ReactNode;
  iconWrapClass: string;
  title: string;
  subtitle: string;
  borderClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2.5 border border-dashed border-neutral-300 px-3.5 py-3 text-left transition-colors hover:border-brand-500 hover:bg-[#FEFCF5]",
        borderClass
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
          iconWrapClass
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-neutral-950">
          {title}
        </span>
        <span className="block text-xs text-neutral-400">{subtitle}</span>
      </span>
    </button>
  );
}

/** Campo de formulario con etiqueta y marcador obligatorio/opcional. */
export function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-sans text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-600">
        {label}{" "}
        {required && <span className="text-brand-500">*</span>}
        {optional && (
          <span className="text-[11px] font-normal normal-case tracking-normal text-neutral-400">
            opcional
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

/** Botón punteado para repetir la acción tras guardar ("Anotar otro…"). */
export function RepeatButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 border border-dashed border-neutral-300 font-mono text-[11px] text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-600"
    >
      <Plus className="size-[11px]" />
      {label}
    </button>
  );
}
