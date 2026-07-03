"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * Botón "+" flotante, esquina inferior derecha — patrón elegido en
 * Design/Navegacion.dc.html (frame 1, marcado "✓ ELEGIDO"). Solo móvil;
 * en escritorio cada pantalla usa el botón "Nuevo cliente" del header.
 */
export function Fab() {
  return (
    <Link
      href="/clientes/nuevo"
      aria-label="Nuevo cliente"
      className="fixed bottom-20 right-5 z-90 flex size-14 items-center justify-center rounded-pill bg-brand-500 text-white shadow-[0_4px_16px_rgba(201,138,10,0.4)] transition-transform hover:scale-105 hover:bg-brand-600 lg:hidden"
    >
      <Plus className="size-6" />
    </Link>
  );
}
