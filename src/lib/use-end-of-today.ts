"use client";

import { useEffect, useState } from "react";
import { endOfToday, msUntilNextMidnight } from "@/lib/dates";

/**
 * Devuelve el fin del día de hoy (local) y lo **recalcula al cruzar la
 * medianoche** o cuando la pestaña vuelve a estar visible (cubre el caso de
 * suspender el equipo durante la noche). Sin esto, dejar la app abierta dejaría
 * la pantalla "Hoy" y la insignia de pendientes ancladas al día anterior.
 *
 * El valor solo cambia cuando cambia el día, así que las consultas de Convex
 * que lo reciben como argumento no se re-ejecutan innecesariamente.
 */
export function useEndOfToday(): number {
  const [value, setValue] = useState(() => endOfToday());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const refresh = () => {
      setValue(endOfToday());
      // +1s de margen para caer con seguridad dentro del nuevo día.
      timeoutId = setTimeout(refresh, msUntilNextMidnight() + 1000);
    };

    timeoutId = setTimeout(refresh, msUntilNextMidnight() + 1000);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setValue(endOfToday());
      clearTimeout(timeoutId);
      timeoutId = setTimeout(refresh, msUntilNextMidnight() + 1000);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return value;
}
