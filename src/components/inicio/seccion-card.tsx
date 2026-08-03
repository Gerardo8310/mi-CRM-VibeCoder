import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * El envoltorio de los dos bloques de abajo de "Inicio" (GER-18) —"Pipeline
 * abierto" y "Actividad reciente"—: cabecera con título y enlace, y cuerpo.
 * Ver `.sec-hdr` / `.sec-title` / `.sec-link` en Design/Inicio.dc.html.
 *
 * Existe como archivo propio, y no como dos cabeceras copiadas, porque el
 * enlace lleva estilo de foco visible y una separación mal copiada entre los dos
 * bloques se ve enseguida. No es `PerfilCard` (components/perfil): aquella tiene
 * subtítulo y línea divisoria, y esta un enlace a la derecha.
 */
export function SeccionCard({
  titulo,
  enlaceTexto,
  enlaceHref,
  children,
}: {
  titulo: string;
  enlaceTexto: string;
  enlaceHref: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-neutral-200 bg-white px-5 py-4.5 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.07em] text-neutral-600">
          {titulo}
        </h2>
        <Link
          href={enlaceHref}
          className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-brand-500 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {enlaceTexto}
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {children}
    </section>
  );
}
