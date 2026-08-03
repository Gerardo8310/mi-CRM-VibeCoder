import { BarChart2 } from "lucide-react";

/**
 * El bloque que sustituye al pipeline y a la actividad cuando **no hay nada
 * registrado en todo el CRM** (GER-18). Ver Design/Inicio.dc.html, estado
 * "SIN DATOS".
 *
 * OJO CON CUÁNDO APARECE. La maqueta ata un único interruptor a todo, y leído
 * al pie de la letra bastaría un mes flojo para esconder el pipeline abierto —
 * es decir, oportunidades vivas y dinero por cobrar. Aquí solo se pinta con el
 * CRM entero vacío, que es cuando de verdad no hay nada que resumir; la regla
 * la decide el servidor (`crmVacio` en convex/dashboard.ts) y no se recalcula
 * en la interfaz.
 */
export function ResumenVacio() {
  return (
    <div className="border border-neutral-200 bg-white px-6 py-8 text-center shadow-xs">
      <div className="mx-auto mb-3.5 flex size-12 items-center justify-center rounded-full bg-neutral-100">
        <BarChart2 className="size-5.5 text-neutral-400" />
      </div>
      <h2 className="mb-1.5 font-mono text-sm font-semibold tracking-[-0.01em] text-neutral-950">
        Aún no hay datos este mes
      </h2>
      <p className="mx-auto max-w-60 text-[13px] leading-relaxed text-neutral-500">
        Registra clientes y ventas para ver el resumen aquí.
      </p>
    </div>
  );
}
