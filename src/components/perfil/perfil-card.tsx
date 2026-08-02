import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * La tarjeta de "Mi cuenta" (GER-49). Ver `.card` / `.card-hdr` / `.card-body`
 * en Design/PerfilUsuario.dc.html.
 *
 * No se usa `Card` de `components/ui/card.tsx` porque esa tiene un relleno
 * único y una cabecera sin subtítulo, y aquí la maqueta separa cabecera y cuerpo
 * con una línea y da a cada uno su propio espaciado. Cambiar la tarjeta base
 * para que encajara aquí movería las demás pantallas que ya la usan.
 */
export function PerfilCard({
  titulo,
  subtitulo,
  children,
  className,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("border border-neutral-200 bg-white shadow-xs", className)}
    >
      <div className="border-b border-neutral-100 px-5 pb-3.5 pt-4">
        <h2 className="font-mono text-xs font-bold tracking-[-0.01em] text-neutral-950">
          {titulo}
        </h2>
        <p className="text-xs text-neutral-400">{subtitulo}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
