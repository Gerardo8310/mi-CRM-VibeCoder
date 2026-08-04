"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { dayOffset, relativeDueLabel } from "@/lib/dates";

/**
 * Seguimientos **pendientes** del cliente en su ficha (GER-16), con botón
 * "Hecho". Al completar uno, sale de aquí y pasa al historial (GER-13) por la
 * reactividad de Convex. Los atrasados se marcan en rojo.
 *
 * ESTA LISTA INCLUYE SEGUIMIENTOS DE OTRAS PERSONAS, y debe hacerlo: la ficha
 * enseña la situación completa del cliente. Lo que se arregla en GER-61 es que
 * antes ofrecía el botón "Hecho" en todas las filas, y `markDone` rechaza las
 * ajenas salvo que quien mira sea la dueña — así que pulsarlo devolvía "no se
 * pudo, inténtalo de nuevo" para siempre, sin decir nunca de quién era la fila.
 *
 * Las dos decisiones vienen resueltas del servidor y no se recalculan aquí:
 * `puedesCerrar` (¿ofrecemos el botón?) y `ownerName` (`null` si es tuyo). Ver
 * `followUps.listForClient`.
 */
export function ClientFollowUps({ clientId }: { clientId: Id<"clients"> }) {
  const followUps = useQuery(api.followUps.listForClient, { id: clientId });
  const markDone = useMutation(api.followUps.markDone);
  const [failed, setFailed] = useState(false);
  // Filas con "Hecho" en curso, para no disparar la mutación dos veces por doble clic.
  const [doing, setDoing] = useState<Set<Id<"followUps">>>(new Set());

  async function handleDone(id: Id<"followUps">) {
    if (doing.has(id)) return;
    setFailed(false);
    setDoing((prev) => new Set(prev).add(id));
    try {
      await markDone({ id });
      // La fila sale sola de la lista por reactividad; no hace falta limpiar `doing`.
    } catch {
      setFailed(true);
      setDoing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (followUps === undefined) {
    return (
      <div className="animate-pulse space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-11 bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (followUps.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-neutral-400">
        Sin seguimientos pendientes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {failed && (
        <p className="text-[12px] leading-snug text-error-700">
          No se pudo marcar como hecho. Inténtalo de nuevo.
        </p>
      )}
      {followUps.map((f) => {
        const overdue = dayOffset(f.dueDate) < 0;
        return (
          <div
            key={f._id}
            className={cn(
              "flex items-start gap-2 border px-3 py-2.5 transition-colors",
              overdue
                ? "border-error-500/25 bg-error-100/40"
                : "border-neutral-200 bg-white"
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-neutral-950">{f.note}</p>
              <span
                className={cn(
                  "font-mono text-[11px] font-medium",
                  overdue ? "text-error-500" : "text-brand-500"
                )}
              >
                {relativeDueLabel(f.dueDate)}
              </span>
              {/* Solo lo ajeno se etiqueta: `ownerName` llega `null` cuando el
                  seguimiento es tuyo. Sin esto, una fila sin botón sería muda. */}
              {f.ownerName !== null && (
                <span className="font-mono text-[11px] text-neutral-400">
                  {" · de "}
                  {f.ownerName}
                </span>
              )}
            </div>
            {f.puedesCerrar && (
              <button
                type="button"
                onClick={() => handleDone(f._id)}
                disabled={doing.has(f._id)}
                className="flex h-[28px] shrink-0 items-center gap-1 border border-neutral-300 px-2 font-mono text-[11px] font-medium text-neutral-600 transition-colors hover:border-success-500 hover:bg-success-100 hover:text-success-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="size-[11px]" />
                Hecho
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
