"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogDismiss } from "@/lib/use-dialog-dismiss";

/**
 * Panel lateral — pantalla completa en móvil, cajón de 400 px a la derecha en
 * escritorio. Ver `.panel` / `.p-hdr` / `.p-body` / `.p-foot` en
 * Design/GestionUsuarios.dc.html.
 *
 * POR QUÉ NO ES `QuickSheet` (src/components/hoy/quick-sheet.tsx): aquel es un
 * modal centrado, que es lo que pide Design/Hoy.dc.html para las altas rápidas.
 * Esta pantalla pide otra cosa —un cajón lateral— y `Design/` es fuente de
 * verdad visual, así que son dos primitivos y no uno con excepciones.
 *
 * Se monta solo cuando está abierto: así los formularios de dentro nacen
 * limpios en cada apertura sin tener que reiniciarlos a mano.
 */
export function SidePanel(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  // El contenido va en un componente aparte, y no es una manía de organización:
  // los enganches de teclado y foco deben existir SOLO mientras el panel está
  // abierto. Con un `if (!open) return null` por delante de ellos, React se
  // quejaría del orden de los hooks; con ellos por delante del `if`, el panel
  // cerrado seguiría capturando Escape.
  if (!props.open) return null;
  return <SidePanelContent {...props} />;
}

function SidePanelContent({
  onClose,
  title,
  children,
  footer,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Sin `capture`: este es el diálogo de abajo cuando hay uno encima (el modal
  // de confirmar). Ver la cabecera de use-dialog-dismiss.
  useDialogDismiss({ ref: panelRef, onClose });

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-100 animate-[fadein_200ms_ease] bg-[rgba(17,16,14,0.45)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Para poder recibir el foco al abrir sin ser un control en sí mismo.
        // `-1` lo deja fuera del recorrido normal del tabulador.
        tabIndex={-1}
        className="fixed inset-0 z-110 flex animate-[slideup_240ms_ease] flex-col bg-white outline-none lg:inset-y-0 lg:left-auto lg:right-0 lg:w-100 lg:animate-[fadein_200ms_ease] lg:shadow-[-8px_0_32px_rgba(17,16,14,0.14)]"
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 px-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex p-1.25 text-neutral-500 transition-colors hover:text-neutral-950"
          >
            <X className="size-[18px]" />
          </button>
          <h2 className="font-mono text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
            {title}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-6">{children}</div>

        <div className="flex shrink-0 gap-2.5 border-t border-neutral-200 px-5 pb-7 pt-3.5">
          {footer}
        </div>
      </div>
    </>
  );
}
