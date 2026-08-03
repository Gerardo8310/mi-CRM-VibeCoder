"use client";

import { useMemo } from "react";
import { useEndOfToday } from "@/lib/use-end-of-today";
import { startOfDaysAgo, startOfMonth, startOfPreviousMonth } from "@/lib/dates";

/**
 * Las seis fronteras que consume `dashboard.summary` (GER-18).
 *
 * Viajan al servidor como argumentos porque Convex no conoce la zona horaria de
 * quien mira: es la misma regla que ya siguen "Hoy" y la insignia de pendientes.
 *
 * LAS SEIS SE REGENERAN DE UNA PIEZA. Se apoya en `useEndOfToday`, que ya
 * recalcula al cruzar la medianoche y al volver la pestaña a estar visible, y de
 * ese valor cuelgan las otras cinco. Sin esto, `finDeHoy` avanzaría al día
 * siguiente mientras `inicioDeHoy` se quedaba en el anterior, y el resumen
 * pasaría a describir un día de 48 horas. No se duplica el temporizador ni se
 * toca `use-end-of-today.ts`, que es de "Hoy".
 *
 * `useMemo` sobre `finDeHoy` mantiene la identidad del objeto entre renders, así
 * que la consulta de Convex no se re-suscribe por cada repintado.
 */
export interface ResumenFronteras {
  inicioMes: number;
  inicioMesAnterior: number;
  inicioCargaActual: number;
  inicioCargaAnterior: number;
  inicioDeHoy: number;
  finDeHoy: number;
}

export function useResumenFronteras(): ResumenFronteras {
  const finDeHoy = useEndOfToday();

  return useMemo(() => {
    // Se deriva del mismo valor que ya filtró "Hoy", no de `Date.now()`: si el
    // día cambió, esta base cambió con él.
    const hoy = startOfDaysAgo(0, finDeHoy);
    return {
      inicioMes: startOfMonth(hoy),
      inicioMesAnterior: startOfPreviousMonth(hoy),
      // Siete fechas locales cada periodo, sin hueco ni solape:
      // actual   [hoy-6, finDeHoy]        -> hoy-6 … hoy
      // anterior [hoy-13, hoy-6)          -> hoy-13 … hoy-7
      inicioCargaActual: startOfDaysAgo(6, hoy),
      inicioCargaAnterior: startOfDaysAgo(13, hoy),
      inicioDeHoy: hoy,
      finDeHoy,
    };
  }, [finDeHoy]);
}
