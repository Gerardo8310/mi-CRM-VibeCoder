"use client";

import { Loader2, UserX } from "lucide-react";

/**
 * Confirmación de desactivar (GER-48). Ver el modal de
 * Design/GestionUsuarios.dc.html.
 *
 * Solo lo pide desactivar, no reactivar: quitarle el acceso a alguien es la
 * acción que conviene confirmar; devolvérselo, no.
 */
export function ConfirmarDesactivar({
  open,
  nombre,
  saving,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  nombre: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  // El nombre de pila para el título, el nombre completo en el cuerpo — como
  // en la maqueta ("¿Desactivar a Carlos?" / "Carlos Vargas ya no podrá…").
  const nombrePila = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-[rgba(17,16,14,0.55)] p-6">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-100 animate-[popin_220ms_ease] border border-neutral-200 bg-white shadow-lg"
      >
        <div className="flex items-start gap-3.5 px-6 pb-5 pt-6">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-error-100">
            <UserX className="size-[18px] text-error-500" />
          </span>
          <div>
            <h3 className="mb-2 font-mono text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
              ¿Desactivar a {nombrePila}?
            </h3>
            <p className="mb-2 text-sm leading-relaxed text-neutral-950">
              <strong className="font-semibold">{nombre}</strong> ya no podrá
              entrar al CRM desde este momento.
            </p>
            <p className="text-[13px] leading-normal text-neutral-400">
              Puedes reactivarlo después desde esta misma pantalla.
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 border-t border-neutral-200 px-6 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-11 flex-1 border border-neutral-300 bg-transparent font-mono text-[13px] font-medium text-neutral-950 transition-colors hover:bg-neutral-950/4 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex h-11 flex-1 items-center justify-center gap-1.75 border border-error-500 bg-error-500 font-mono text-[13px] font-medium text-white transition-colors hover:border-error-700 hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? (
              <Loader2 className="size-3.25 animate-spin" />
            ) : (
              <UserX className="size-3.25" />
            )}
            Sí, desactivar
          </button>
        </div>
      </div>
    </div>
  );
}
