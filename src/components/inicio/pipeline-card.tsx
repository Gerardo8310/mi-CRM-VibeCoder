import type { Resumen } from "@convex/dashboard";
import { STAGES } from "@/lib/opportunity-stages";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SeccionCard } from "@/components/inicio/seccion-card";

/**
 * "Pipeline abierto" (GER-18). Ver Design/Inicio.dc.html, tercer bloque.
 *
 * ES UNA FOTO DEL MOMENTO, no un acumulado del mes — lo dice el issue. Por eso
 * sigue viéndose aunque el mes vaya flojo: son oportunidades vivas y dinero por
 * cobrar, y esconderlas por el calendario sería tapar la mejor información de
 * la pantalla.
 *
 * Los colores de las etiquetas salen de `STAGES` (src/lib/opportunity-stages.ts),
 * el mismo sitio del que los toma el tablero. La maqueta trae sus propios
 * valores, ligeramente distintos porque es anterior al archivo de tokens; se
 * prefiere que "Interesado" se vea igual aquí y en "Ventas" a clavar el hex.
 */
export function PipelineCard({ pipeline }: { pipeline: Resumen["pipeline"] }) {
  const conDatos = pipeline.porEtapa.filter((e) => e.cantidad > 0);

  return (
    <SeccionCard titulo="Pipeline abierto" enlaceTexto="Ver tablero" enlaceHref="/ventas">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[26px] font-bold leading-none tracking-[-0.03em] text-neutral-950">
          {formatMoney(pipeline.total)}
        </span>
        <span className="text-[13px] text-neutral-500">
          MXN · {pipeline.cantidad} oportunidad
          {pipeline.cantidad !== 1 ? "es" : ""}
        </span>
      </div>

      {conDatos.length === 0 ? (
        // El bloque conserva cabecera y enlace: desde aquí se sigue pudiendo ir
        // al tablero a registrar la primera. Un contenedor vacío sin explicación
        // parecería un fallo de carga.
        <p className="text-[13px] leading-relaxed text-neutral-400">
          No hay oportunidades abiertas ahora mismo.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Una etapa a cero no pinta etiqueta: "Cotizado · 0 · $0" es ruido. */}
          {conDatos.map(({ etapa, cantidad, monto }) => (
            <div
              key={etapa}
              className={cn(
                "inline-flex items-center gap-1.5 border px-2.5 py-1",
                STAGES[etapa].badge
              )}
            >
              <span className="font-mono text-[11px] font-bold">
                {STAGES[etapa].label}
              </span>
              <span className="text-xs opacity-80">
                {cantidad} · {formatMoney(monto)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SeccionCard>
  );
}
