"use client";

import type { ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Panel rápido para las altas desde "Hoy" (GER-50): bottom sheet en móvil,
 * modal centrado en escritorio (ver Design/Hoy.dc.html). Se monta solo cuando
 * está abierto y se cierra tocando el fondo, la X o Cancelar.
 */
export function QuickSheet({
  open,
  onClose,
  icon,
  iconWrapClass,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  iconWrapClass: string;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-100 animate-[fadein_200ms_ease] bg-[rgba(17,16,14,0.5)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-101 animate-[slideup_230ms_ease] border-t border-neutral-200 bg-white lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[460px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:animate-[fadein_200ms_ease] lg:border lg:shadow-lg"
      >
        {/* Asa (solo móvil) */}
        <div className="flex justify-center pb-1 pt-2.5 lg:hidden">
          <div className="h-1 w-8 rounded-pill bg-neutral-300" />
        </div>

        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 pb-3 pt-1.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full",
                iconWrapClass
              )}
            >
              {icon}
            </span>
            <h3 className="font-mono text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1 text-neutral-500 transition-colors hover:text-neutral-950"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {children}
        {footer}
      </div>
    </>
  );
}

/** Pie del panel: Cancelar + Guardar (con estado de carga). */
export function SheetFooter({
  onCancel,
  onSave,
  saving,
  canSave,
  saveLabel,
  saveIcon,
  saveClass,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  saveLabel: string;
  saveIcon: ReactNode;
  saveClass?: string;
}) {
  return (
    <div className="flex gap-2.5 px-4 pb-5 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="h-11 flex-1 border border-neutral-300 bg-transparent font-mono text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || saving}
        className={cn(
          "flex h-11 flex-[2] items-center justify-center gap-1.5 border font-mono text-[13px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45",
          saveClass ?? "border-brand-500 bg-brand-500 hover:bg-brand-600"
        )}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : saveIcon}
        {saveLabel}
      </button>
    </div>
  );
}
