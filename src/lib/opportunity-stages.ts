/**
 * Config de las tres etapas de una oportunidad (interesado / cotizado / cerrado)
 * — fuente única que comparten el registro de oportunidad (ficha, tablero y la
 * "Venta rápida" de "Hoy"), el tablero Kanban (GER-15) y el historial (GER-13).
 * **Solo frontend** (clases de Tailwind): no importar desde Convex/backend.
 */
export type Stage = "interesado" | "cotizado" | "cerrado";

export const STAGE_ORDER: Stage[] = ["interesado", "cotizado", "cerrado"];

export type StageConfig = {
  key: Stage;
  label: string;
  /** Texto de ayuda bajo el selector segmentado. */
  desc: string;
  /** Botón segmentado activo (formulario de registro). */
  segOn: string;
  /** Insignia (chip). Incluye color de borde; el consumidor decide si pinta `border`. */
  badge: string;
  /** Tablero: color de borde de la columna. */
  colBorder: string;
  /** Tablero: fondo + texto del header de columna. */
  colHeader: string;
  /** Tablero: fondo del cuerpo de la columna. */
  colBody: string;
  /** Tablero: chip de conteo del header. */
  colCount: string;
};

export const STAGES: Record<Stage, StageConfig> = {
  interesado: {
    key: "interesado",
    label: "Interesado",
    desc: "Contacto que mostró interés — aún sin cotización",
    segOn: "bg-info-100 border-info-700/35 text-info-700 font-bold",
    badge: "bg-info-100 text-info-700 border-info-700/25",
    colBorder: "border-info-700/20",
    colHeader: "bg-info-100 text-info-700",
    colBody: "bg-[#F6F9FE]",
    colCount: "bg-info-700/15 text-info-700",
  },
  cotizado: {
    key: "cotizado",
    label: "Cotizado",
    desc: "Propuesta enviada — esperando respuesta",
    segOn: "bg-brand-50 border-brand-500/45 text-brand-700 font-bold",
    badge: "bg-warning-100 text-warning-700 border-warning-500/25",
    colBorder: "border-brand-500/22",
    colHeader: "bg-brand-50 text-warning-700",
    colBody: "bg-[#FFFDF8]",
    colCount: "bg-brand-500/18 text-brand-700",
  },
  cerrado: {
    key: "cerrado",
    label: "Cerrado",
    desc: "¡Trato ganado! Se registra como venta cerrada",
    segOn: "bg-success-100 border-success-500/35 text-success-700 font-bold",
    badge: "bg-success-100 text-success-700 border-success-500/25",
    colBorder: "border-success-500/22",
    colHeader: "bg-success-100 text-success-700",
    colBody: "bg-[#F4FAF5]",
    colCount: "bg-success-500/18 text-success-700",
  },
};

export const STAGE_LIST: StageConfig[] = STAGE_ORDER.map((s) => STAGES[s]);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Etiqueta de antigüedad de una oportunidad abierta: "Hoy" / "N días". */
export function daysOpenLabel(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / DAY_MS);
  if (days <= 0) return "Hoy";
  return `${days} día${days !== 1 ? "s" : ""}`;
}
