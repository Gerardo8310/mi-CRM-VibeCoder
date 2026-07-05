/**
 * Utilidades de fecha para la UI (lado cliente — usan la hora local del
 * navegador). Las fronteras del día se pasan como argumentos a las consultas
 * de Convex para que "hoy" respete la zona horaria del usuario, no la UTC del
 * servidor. Ver convex/followUps.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Marca de tiempo de la medianoche (local) del día que contiene `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Medianoche de hoy (local). */
export function startOfToday(): number {
  return startOfDay(Date.now());
}

/** Último milisegundo de hoy (local) — límite superior para "atrasados + hoy". */
export function endOfToday(): number {
  return startOfToday() + DAY_MS - 1;
}

/** Milisegundos que faltan para la próxima medianoche (local). */
export function msUntilNextMidnight(): number {
  return startOfToday() + DAY_MS - Date.now();
}

/**
 * Convierte el valor de un <input type="date"> (YYYY-MM-DD) a la medianoche
 * **local** de ese día. Ojo: `new Date("YYYY-MM-DD")` lo interpretaría como
 * medianoche UTC y, en husos negativos (México), guardaría el día anterior.
 * Devuelve `undefined` si el valor no es una fecha válida.
 */
export function timestampFromDateInput(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const [, year, month, day] = match;
  const ts = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

/** Diferencia en días entre el día de `ts` y hoy (negativo = pasado). */
export function dayOffset(ts: number): number {
  return Math.round((startOfDay(ts) - startOfToday()) / DAY_MS);
}

/** Encabezado de la pantalla, p. ej. "Jueves, 3 de julio". */
export function formatDayHeading(ts: number = Date.now()): string {
  return capitalize(
    new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(ts)
  );
}

/** Etiqueta relativa para un pendiente: "Hoy", "Ayer", "Hace 3 días". */
export function relativeDueLabel(ts: number): string {
  const offset = dayOffset(ts);
  if (offset === 0) return "Hoy";
  if (offset === -1) return "Ayer";
  if (offset < -1) return `Hace ${-offset} días`;
  if (offset === 1) return "Mañana";
  return `En ${offset} días`;
}

/** Etiqueta del mini calendario: "Mañana · Mar 24" o "Mié 25". */
export function calendarLabel(ts: number): string {
  const d = new Date(ts);
  const short = `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`;
  return dayOffset(ts) === 1 ? `Mañana · ${short}` : short;
}

const TIME_FMT = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
});

/**
 * Marca de tiempo para el historial del cliente (GER-13): entradas recientes en
 * relativo con hora ("Hoy · 10:30", "Ayer · 16:15"), luego "Hace N días",
 * "Hace 1 semana", "Hace N semanas", y a partir de ~1 mes (o fechas futuras) la
 * fecha corta "3 jul".
 */
export function historyTimestamp(ts: number): string {
  const offset = dayOffset(ts); // negativo = pasado
  if (offset === 0) return `Hoy · ${TIME_FMT.format(ts)}`;
  if (offset === -1) return `Ayer · ${TIME_FMT.format(ts)}`;
  const daysAgo = -offset;
  if (daysAgo >= 2 && daysAgo <= 6) return `Hace ${daysAgo} días`;
  if (daysAgo >= 7 && daysAgo <= 13) return "Hace 1 semana";
  if (daysAgo >= 14 && daysAgo <= 27) return `Hace ${Math.floor(daysAgo / 7)} semanas`;
  return SHORT_DATE_FMT.format(ts);
}
