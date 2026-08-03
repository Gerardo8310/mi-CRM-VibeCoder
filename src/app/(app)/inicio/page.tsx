"use client";

import { useQuery } from "convex/react";
import { CircleDollarSign, Clock, UserPlus } from "lucide-react";
import { api } from "@convex/_generated/api";
import { formatMoney } from "@/lib/money";
import { useResumenFronteras } from "@/lib/use-resumen-fronteras";
import { InicioHeader } from "@/components/inicio/inicio-header";
import { MetricCard, type Tendencia } from "@/components/inicio/metric-card";
import { PipelineCard } from "@/components/inicio/pipeline-card";
import { ActividadCard } from "@/components/inicio/actividad-card";
import { ResumenVacio } from "@/components/inicio/resumen-vacio";

/**
 * Pantalla 6 — "Inicio / Resumen del negocio" (GER-18). Landing de Martha tras
 * iniciar sesión (el reparto por rol lo hace src/app/page.tsx desde GER-7).
 * Ver Design/Inicio.dc.html.
 *
 * Los cinco bloques vienen de UNA sola consulta, `dashboard.summary`. Ahí está
 * explicado por qué: cinco consultas serían cinco cargas que se resuelven en
 * distinto orden, y por el camino la pantalla llegaría a afirmar que el CRM está
 * vacío con los datos a medio llegar.
 *
 * ESTA PANTALLA NO DEFINE NINGÚN NÚMERO, solo los redacta. Qué cuenta como
 * "este mes", qué es un atrasado o de quién son los pendientes lo decide
 * convex/dashboard.ts; aquí se elige la palabra ("más", "menos", "sin cambio") y
 * la flecha. Si alguna vez discrepan, manda el servidor.
 */
export default function InicioPage() {
  const fronteras = useResumenFronteras();
  const resumen = useQuery(api.dashboard.summary, fronteras);

  if (resumen === undefined || resumen === null) {
    // `null` es "no hay sesión utilizable": `SessionGuard` ya está llevando a
    // /login, así que se deja el esqueleto en vez de parpadear un panel a cero.
    return (
      <>
        <InicioHeader />
        <ResumenSkeleton />
      </>
    );
  }

  const { clientesNuevos, ventas, pendientes, pipeline, actividad, crmVacio } =
    resumen;

  return (
    <>
      <InicioHeader />

      <div className="px-4 pb-20 pt-5 lg:px-8 lg:pb-10 lg:pt-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:gap-5">
          <MetricCard
            href="/clientes"
            icon={UserPlus}
            tono="info"
            valor={clientesNuevos.valor === 0 ? null : String(clientesNuevos.valor)}
            etiqueta="Clientes nuevos este mes"
            tendencia={tendencia(
              crmVacio,
              clientesNuevos.valor,
              clientesNuevos.anterior,
              "el mes pasado"
            )}
          />

          <MetricCard
            href="/ventas"
            icon={CircleDollarSign}
            tono="success"
            // El número grande es el monto, como en la maqueta; la cantidad —que
            // el issue también pide— va en la etiqueta, donde cabe sin competir
            // con la cifra.
            //
            // Las dos se deciden con `cantidad`, no una con el monto y otra con
            // la cantidad: son la misma pregunta —"¿hubo ventas este mes?"— y
            // separarlas dejaba la puerta a un "—" enorme junto a "1 venta
            // cerrada este mes". Hoy no puede pasar porque `opportunities.create`
            // exige importe mayor que cero, pero eso es una guarda de otro
            // archivo y aquí no se ve.
            valor={ventas.cantidad === 0 ? null : formatMoney(ventas.monto)}
            etiqueta={
              ventas.cantidad === 0
                ? "Ventas cerradas este mes"
                : `${ventas.cantidad} venta${ventas.cantidad !== 1 ? "s" : ""} cerrada${ventas.cantidad !== 1 ? "s" : ""} este mes`
            }
            tendencia={tendencia(
              crmVacio,
              ventas.monto,
              ventas.montoAnterior,
              "el mes pasado",
              formatMoney
            )}
          />

          <MetricCard
            href="/hoy"
            icon={Clock}
            tono="brand"
            valor={pendientes.total === 0 ? null : String(pendientes.total)}
            etiqueta="Seguimientos pendientes"
            // La tendencia mide CARGA —cuántos seguimientos vencieron en cada
            // periodo—, no cuántos estaban pendientes: ese histórico no existe.
            // Ver convex/dashboard.ts.
            tendencia={tendencia(
              crmVacio,
              pendientes.cargaActual,
              pendientes.cargaAnterior,
              "la semana pasada"
            )}
            atrasados={pendientes.atrasados}
          />
        </div>

        {/*
          Con el CRM vacío los tres números ya salen en "—" por sí solos —todo
          está a cero— y `tendencia()` calla la comparación con esta misma
          bandera. Lo único que queda por decidir aquí es qué va debajo.
        */}
        {crmVacio ? (
          <ResumenVacio />
        ) : (
          <div className="flex flex-col gap-4">
            <PipelineCard pipeline={pipeline} />
            <ActividadCard actividad={actividad} />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Redacta una comparación entre dos periodos.
 *
 * "SIN DATOS ANTERIORES" ES EL CRM VACÍO, NO UN PERIODO A CERO. Una versión
 * anterior devolvía "sin datos" en cuanto `anterior === 0`, y estaba mal: un cero
 * del mes pasado es un dato, no su ausencia. Con esa regla, un negocio que pasa
 * de 0 clientes a 3 leía "Sin datos anteriores" — justo la subida que esta
 * pantalla existe para enseñar quedaba escondida, y en un negocio pequeño un mes
 * a cero es de lo más normal.
 *
 * Ahora la comparación se calla solo cuando no hay CRM que comparar, que es
 * además lo que pide el issue al describir el estado vacío. La bandera la decide
 * `dashboard.summary`, no un cero interpretado aquí.
 */
function tendencia(
  crmVacio: boolean,
  actual: number,
  anterior: number,
  periodo: string,
  formatea: (n: number) => string = String
): Tendencia {
  if (crmVacio) return { tipo: "sin-datos" };

  const diferencia = actual - anterior;
  if (diferencia === 0) {
    return { tipo: "igual", texto: `Sin cambio vs ${periodo}` };
  }
  return {
    tipo: diferencia > 0 ? "sube" : "baja",
    texto: `${formatea(Math.abs(diferencia))} ${diferencia > 0 ? "más" : "menos"} que ${periodo}`,
  };
}

/**
 * Mientras carga se dibuja la forma, no números en blanco: un panel que enseña
 * ceros y luego los cambia hace dudar del primero que se leyó.
 */
function ResumenSkeleton() {
  return (
    <div className="animate-pulse px-4 pb-20 pt-5 lg:px-8 lg:pb-10 lg:pt-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:gap-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[148px] border border-neutral-200 bg-white lg:h-[166px] lg:flex-1"
          />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-[124px] border border-neutral-200 bg-white" />
        <div className="h-[220px] border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}
