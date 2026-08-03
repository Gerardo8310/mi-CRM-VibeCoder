import Link from "next/link";
import type { Resumen } from "@convex/dashboard";
import { INTERACTION_TYPES } from "@/lib/interaction-types";
import { historyTimestamp } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { SeccionCard } from "@/components/inicio/seccion-card";

/**
 * "Actividad reciente" (GER-18). Ver Design/Inicio.dc.html, cuarto bloque.
 *
 * "Ver todo" lleva a `/clientes` y no a una pantalla de actividad global, que no
 * existe en el MVP: el historial completo vive dentro de la ficha de cada
 * cliente, y la lista de clientes es la puerta a todas ellas. Cada fila lleva
 * directa a la suya, que es donde de verdad se ve el detalle.
 *
 * `historyTimestamp` es el mismo formateador del historial de la ficha
 * (GER-13), y da exactamente el "Ayer / Hace 3 días / Hace 1 semana" que pide la
 * maqueta. No se escribe otro: dos formatos distintos para la misma idea acaban
 * discrepando.
 */
export function ActividadCard({
  actividad,
}: {
  actividad: Resumen["actividad"];
}) {
  return (
    <SeccionCard titulo="Actividad reciente" enlaceTexto="Ver todo" enlaceHref="/clientes">
      {actividad.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-neutral-400">
          Aún no se ha registrado ninguna interacción.
        </p>
      ) : (
        <div className="-mb-3">
          {actividad.map((a) => {
            // Seguro: `tipo` llega del servidor ya normalizado a uno de los tres
            // literales (ver `dashboard.summary`), nunca `undefined`. Es el
            // mismo patrón de `anotar-interaction-sheet.tsx:38`.
            const tipo = INTERACTION_TYPES.find((t) => t.key === a.tipo)!;
            return (
              <Link
                key={a.id}
                href={`/clientes/${a.clientId}`}
                className="flex items-start gap-2.5 border-b border-neutral-100 py-3 transition-colors last:border-b-0 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
              >
                <Avatar name={a.clientName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-neutral-950">
                      {a.clientName}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-neutral-400">
                      {historyTimestamp(a.fecha)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-neutral-500">
                    {tipo.label} — {a.texto}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SeccionCard>
  );
}
